// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Landmarks (§8.5). Themes drive tile-encounter matching. The boss landmark
// (Final Laboratory) is always the run's endpoint.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const landmarks = [
  { id: "deadMarsh", name: "Dead Marsh", theme: "marsh", isBoss: false },
  { id: "radioTower", name: "Radio Tower", theme: "tower", isBoss: false },
  { id: "chemicalPlant", name: "Chemical Plant", theme: "chem", isBoss: false },
  { id: "finalLaboratory", name: "Final Laboratory", theme: "boss", isBoss: true },
];

function landmarkById(id) {
  return landmarks.find((l) => l.id === id) || null;
}
