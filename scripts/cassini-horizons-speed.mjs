const endpoint = "https://ssd.jpl.nasa.gov/api/horizons.api";
const closestApproachUtc = Date.parse("1999-08-18T03:28:00Z");
const tdbMinusUtcMs = 64.184 * 1_000;
const stepHours = 6;
const earthSphereOfInfluenceKm = 924_000;
const sunMuM3PerS2 = 1.32712440018e20;
const auM = 149_597_870_700;

function horizonsDateFromUtc(timestamp) {
  return new Date(timestamp + tdbMinusUtcMs)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
}

function tdbToUtc(date) {
  const match = date.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
  if (!match) throw new Error(`Unrecognized Horizons timestamp: ${date}`);
  const tdbTimestamp = Date.parse(`${match[3]} ${match[2]} ${match[1]} ${match[4]} UTC`);
  const timestamp = tdbTimestamp - tdbMinusUtcMs;
  if (Number.isNaN(timestamp)) throw new Error(`Invalid Horizons timestamp: ${date}`);
  return new Date(timestamp).toISOString();
}

async function fetchVectors(command, startUtc, stopUtc) {
  const parameters = new URLSearchParams({
    format: "json",
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${horizonsDateFromUtc(startUtc)}'`,
    STOP_TIME: `'${horizonsDateFromUtc(stopUtc)}'`,
    STEP_SIZE: `'${stepHours}h'`
  });

  const response = await fetch(`${endpoint}?${parameters}`);
  if (!response.ok) {
    throw new Error(`JPL Horizons API for ${command} returned HTTP ${response.status} ${response.statusText}.`);
  }
  const payload = await response.json();
  if (typeof payload.result !== "string") {
    throw new Error(`JPL Horizons response for ${command} did not contain its expected result text.`);
  }

  const startMarker = payload.result.indexOf("$$SOE");
  const endMarker = payload.result.indexOf("$$EOE");
  if (startMarker < 0 || endMarker <= startMarker) {
    throw new Error(`JPL Horizons response for ${command} is missing its vector-table markers.`);
  }

  const rows = [];
  let currentDate;
  let currentPosition;
  let currentVelocity;
  for (const line of payload.result.slice(startMarker + "$$SOE".length, endMarker).split(/\r?\n/)) {
    const dateMatch = line.match(
      /\bA\.D\.\s+(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+TDB\b/
    );
    if (dateMatch) {
      currentDate = tdbToUtc(dateMatch[1]);
      currentPosition = undefined;
      currentVelocity = undefined;
      continue;
    }
    if (currentDate === undefined) continue;

    const positionMatch = line.match(
      /^\s*X\s*=\s*([+-]?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)\s+Y\s*=\s*([+-]?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)\s+Z\s*=\s*([+-]?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)/i
    );
    if (positionMatch) {
      currentPosition = positionMatch.slice(1).map(Number);
      continue;
    }
    const velocityMatch = line.match(
      /^\s*VX\s*=\s*([+-]?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)\s+VY\s*=\s*([+-]?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)\s+VZ\s*=\s*([+-]?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)/i
    );
    if (velocityMatch) {
      currentVelocity = velocityMatch.slice(1).map(Number);
    }
    if (currentPosition && currentVelocity) {
      rows.push({
        date: currentDate,
        timestamp: Date.parse(currentDate),
        positionKm: currentPosition,
        velocityKmPerSecond: currentVelocity
      });
      currentDate = undefined;
    }
  }

  if (rows.length === 0) {
    throw new Error(`No heliocentric position and velocity vectors were parsed for ${command}.`);
  }
  return rows;
}

function combineEarthAndCassini(cassiniRows, earthRows) {
  if (cassiniRows.length !== earthRows.length) {
    throw new Error(
      `Horizons returned different sample counts for Cassini (${cassiniRows.length}) and Earth (${earthRows.length}).`
    );
  }
  return cassiniRows.map((cassini, index) => {
    const earth = earthRows[index];
    if (cassini.timestamp !== earth.timestamp) {
      throw new Error(
        `Horizons sample epochs do not match: Cassini ${cassini.date}; Earth ${earth.date}.`
      );
    }
    const distanceKm = Math.hypot(
      cassini.positionKm[0] - earth.positionKm[0],
      cassini.positionKm[1] - earth.positionKm[1],
      cassini.positionKm[2] - earth.positionKm[2]
    );
    const speedKmPerSecond = Math.hypot(...cassini.velocityKmPerSecond);
    return {
      ...cassini,
      earthPositionKm: earth.positionKm,
      earthVelocityKmPerSecond: earth.velocityKmPerSecond,
      distanceKm,
      speedKmPerSecond
    };
  });
}

function findSoiBoundarySamples(rows) {
  const closestIndex = rows.reduce(
    (bestIndex, row, index) => row.distanceKm < rows[bestIndex].distanceKm ? index : bestIndex,
    0
  );
  let inboundOutsideIndex = -1;
  for (let index = 1; index <= closestIndex; index += 1) {
    if (
      rows[index - 1].distanceKm > earthSphereOfInfluenceKm &&
      rows[index].distanceKm <= earthSphereOfInfluenceKm
    ) {
      inboundOutsideIndex = index - 1;
    }
  }

  let outboundOutsideIndex = -1;
  for (let index = closestIndex + 1; index < rows.length; index += 1) {
    if (
      rows[index - 1].distanceKm <= earthSphereOfInfluenceKm &&
      rows[index].distanceKm > earthSphereOfInfluenceKm
    ) {
      outboundOutsideIndex = index;
      break;
    }
  }

  return { closestIndex, inboundOutsideIndex, outboundOutsideIndex };
}

function specificOrbitalEnergy(row) {
  const positionM = row.positionKm.map((component) => component * 1_000);
  const velocityMps = row.velocityKmPerSecond.map((component) => component * 1_000);
  const radiusM = Math.hypot(...positionM);
  const speedMps = Math.hypot(...velocityMps);
  return speedMps ** 2 / 2 - sunMuM3PerS2 / radiusM;
}

function speedAtOneAu(energyJPerKg) {
  const squaredSpeed = 2 * (energyJPerKg + sunMuM3PerS2 / auM);
  if (squaredSpeed < 0) throw new Error("Specific orbital energy yields an imaginary speed at 1 AU.");
  return Math.sqrt(squaredSpeed);
}

const formatDate = (row) => row.date.slice(0, 19).replace("T", " ");
const formatPosition = (position) => position.map((component) => component.toFixed(3)).join(", ");

let windowDays = 4;
let rows;
let boundaries;
while (true) {
  const startUtc = closestApproachUtc - windowDays * 86_400_000;
  const stopUtc = closestApproachUtc + windowDays * 86_400_000;
  const [cassiniRows, earthRows] = await Promise.all([
    fetchVectors("-82", startUtc, stopUtc),
    fetchVectors("399", startUtc, stopUtc)
  ]);
  rows = combineEarthAndCassini(cassiniRows, earthRows);
  boundaries = findSoiBoundarySamples(rows);
  if (boundaries.inboundOutsideIndex >= 0 && boundaries.outboundOutsideIndex >= 0) break;
  windowDays += 10;
  if (windowDays > 100) {
    throw new Error("Could not capture both Earth sphere-of-influence crossings within a ±100-day window.");
  }
  console.log(`Both SOI boundary samples not captured; retrying with a ±${windowDays}-day window.`);
}

const inboundBoundary = rows[boundaries.inboundOutsideIndex];
const outboundBoundary = rows[boundaries.outboundOutsideIndex];
const inboundEnergy = specificOrbitalEnergy(inboundBoundary);
const outboundEnergy = specificOrbitalEnergy(outboundBoundary);
const energyDifference = outboundEnergy - inboundEnergy;
const energyPercentDifference = (energyDifference / Math.abs(inboundEnergy)) * 100;
const inboundOneAuSpeed = speedAtOneAu(inboundEnergy);
const outboundOneAuSpeed = speedAtOneAu(outboundEnergy);
const heliocentricVelocityDifference = outboundBoundary.velocityKmPerSecond.map(
  (component, index) => component - inboundBoundary.velocityKmPerSecond[index]
);
const heliocentricVelocityDifferenceMagnitude = Math.hypot(...heliocentricVelocityDifference);
const earthRelativeVelocity = (row) => row.velocityKmPerSecond.map(
  (component, index) => component - row.earthVelocityKmPerSecond[index]
);
const inboundEarthRelativeVelocity = earthRelativeVelocity(inboundBoundary);
const outboundEarthRelativeVelocity = earthRelativeVelocity(outboundBoundary);

console.log("Cassini-Earth distance and Earth-SOI boundary energy comparison");
console.log("  Cassini: Horizons ID -82; Earth: ID 399; center: 500@10 (Sun); cadence: 6 hours");
console.log(`  Window: ${formatDate(rows[0])} through ${formatDate(rows.at(-1))} UTC; ${rows.length} matched samples; ±${windowDays}-day span`);
console.log(`  Earth sphere-of-influence radius: ${earthSphereOfInfluenceKm.toLocaleString("en-US")} km`);
console.log("  Cassini heliocentric position (km), Earth heliocentric position (km), and Cassini-Earth distance (km):");
for (const row of rows) {
  console.log(
    `    ${formatDate(row)} UTC — Cassini=(${formatPosition(row.positionKm)}); Earth=(${formatPosition(row.earthPositionKm)}); distance=${row.distanceKm.toFixed(3)} km`
  );
}

console.log("\nEarth SOI boundary samples (exterior sample on each side):");
console.log(`  Inbound, just outside: ${formatDate(inboundBoundary)} UTC — distance ${inboundBoundary.distanceKm.toFixed(3)} km`);
console.log(`  Outbound, just outside: ${formatDate(outboundBoundary)} UTC — distance ${outboundBoundary.distanceKm.toFixed(3)} km`);
console.log("\nSun-only specific orbital energy at those SOI boundary samples:");
console.log(`  Inbound: ${inboundEnergy.toFixed(3)} J/kg`);
console.log(`  Outbound: ${outboundEnergy.toFixed(3)} J/kg`);
console.log(`  Energy difference (outbound − inbound): ${energyDifference.toFixed(3)} J/kg`);
console.log(`  Percent difference relative to |inbound energy|: ${energyPercentDifference.toFixed(6)}%`);
console.log(`  1-AU-equivalent speed, inbound: ${(inboundOneAuSpeed / 1_000).toFixed(6)} km/s`);
console.log(`  1-AU-equivalent speed, outbound: ${(outboundOneAuSpeed / 1_000).toFixed(6)} km/s`);
console.log(`  1-AU-equivalent speed difference (outbound − inbound): ${((outboundOneAuSpeed - inboundOneAuSpeed) / 1_000).toFixed(6)} km/s`);
console.log("\nHorizons heliocentric velocity vectors at those SOI boundary samples:");
console.log(`  Inbound: (${formatPosition(inboundBoundary.velocityKmPerSecond)}) km/s`);
console.log(`  Outbound: (${formatPosition(outboundBoundary.velocityKmPerSecond)}) km/s`);
console.log(`  Vector difference (outbound − inbound): (${formatPosition(heliocentricVelocityDifference)}) km/s`);
console.log(`  Vector-difference magnitude: ${heliocentricVelocityDifferenceMagnitude.toFixed(6)} km/s`);
console.log("  Earth-relative v-infinity at those samples:");
console.log(`  Inbound: ${Math.hypot(...inboundEarthRelativeVelocity).toFixed(6)} km/s`);
console.log(`  Outbound: ${Math.hypot(...outboundEarthRelativeVelocity).toFixed(6)} km/s`);
