import { startPassengerApp } from './src/server.js';

const passenger = globalThis.PhusionPassenger;
if (!passenger) throw new Error('Ce fichier de démarrage est réservé à Phusion Passenger. Utilise npm start en dehors de cPanel.');

await startPassengerApp(passenger);
console.log(`Capharnaüm — application Passenger prête${process.env.BASE_PATH ? ` sur ${process.env.BASE_PATH}` : ''}.`);
