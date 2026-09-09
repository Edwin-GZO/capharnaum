'use strict';

async function demarrer() {
  const passenger = globalThis.PhusionPassenger;
  if (passenger) passenger.configure({ autoInstall: false });

  const { createApp } = await import('./src/server.js');
  const app = createApp();
  app.listen('passenger', () => {
    console.log(`Capharnaüm — application Passenger prête${process.env.BASE_PATH ? ` sur ${process.env.BASE_PATH}` : ''}.`);
  });
}

demarrer().catch(error => {
  console.error('Impossible de démarrer Capharnaüm avec Passenger :', error);
  process.exitCode = 1;
});
