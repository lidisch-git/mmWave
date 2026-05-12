const { createBluetooth } = require("node-ble");
const { bluetooth, destroy } = createBluetooth();

async function main() {
  const adapter = await bluetooth.defaultAdapter();
  await adapter.startDiscovery();

  const device = await adapter.waitDevice("20:AF:52:61:4D:AB");
  await device.connect();
  console.log("Verbunden!");
  await adapter.stopDiscovery();

  const gattServer = await device.gatt();
  const service = await gattServer.getPrimaryService("0000fff0-0000-1000-8000-00805f9b34fb");
  const characteristic = await service.getCharacteristic("0000fff1-0000-1000-8000-00805f9b34fb");

  await characteristic.startNotifications();
  console.log("Empfange Daten...");

  characteristic.on("valuechanged", (buf) => {
    console.log("RAW:", buf.toString("hex"));
    parseFrame(buf);
  });

  // Sauber beenden mit Ctrl+C
  process.on("SIGINT", async () => {
    await characteristic.stopNotifications();
    await device.disconnect();
    destroy();
    process.exit(0);
  });
}

function parseFrame(buf) {
  // Header prüfen: AA FF 03 00
  if (buf[0] !== 0xAA || buf[1] !== 0xFF) return;

  for (let i = 0; i < 3; i++) {
    const offset = 4 + i * 8;
    if (offset + 8 > buf.length) break;
    const x = buf.readInt16LE(offset);
    const y = buf.readInt16LE(offset + 2);
    const speed = buf.readInt16LE(offset + 4);
    if (x !== 0 || y !== 0) {
      console.log(`Ziel ${i + 1}: x=${x}mm  y=${y}mm  speed=${speed}cm/s`);
    }
  }
}

main().catch(console.error);