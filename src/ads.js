// Point d'entrée unique pour les pubs récompensées (revivre, doubler les braises).
// - Dans l'application Android/iOS : vraies pubs AdMob.
// - Dans un navigateur : simulation de 3 secondes.
//
// IMPORTANT : les identifiants ci-dessous sont les identifiants de TEST officiels de Google.
// Avant de publier, remplace REWARDED_ID par ton bloc d'annonces AdMob, et l'identifiant
// d'application dans android/app/src/main/res/values/strings.xml (admob_app_id).
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

const REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'; // identifiant de test Google
const TESTING = true; // passer à false une fois ton propre identifiant en place
const native = Capacitor.isNativePlatform();
let ready = null;

function init() {
  if (!ready) ready = AdMob.initialize({ initializeForTesting: TESTING }).then(() => AdMob.prepareRewardVideoAd({ adId: REWARDED_ID, isTesting: TESTING })).catch(() => { ready = null; });
  return ready;
}
if (native) init();

function simulated() {
  return new Promise(resolve => {
    const el = document.getElementById('ad'), t = document.getElementById('adt');
    let n = 3; t.textContent = n; el.classList.remove('hidden');
    const iv = setInterval(() => { n--; t.textContent = n; if (n <= 0) { clearInterval(iv); el.classList.add('hidden'); resolve(true); } }, 1000);
  });
}

// Renvoie true si le joueur a regardé la pub jusqu'au bout.
export async function showRewardedAd() {
  if (!native) return simulated();
  try {
    await init();
    const r = await AdMob.showRewardVideoAd();
    ready = null; init(); // prépare la pub suivante
    return !!(r && r.amount !== undefined);
  } catch (e) { ready = null; init(); return false; }
}
