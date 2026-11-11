// Point d'entrée unique pour les pubs récompensées.
// Aujourd'hui : simulation de 3 s. Pour gagner de l'argent, remplacer le corps de
// showRewardedAd() par l'appel au SDK (ex. AdMob via @capacitor-community/admob) :
//   await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-XXXX/YYYY' });
//   const r = await AdMob.showRewardVideoAd(); return !!r;
export function showRewardedAd() {
  return new Promise(resolve => {
    const el = document.getElementById('ad'), t = document.getElementById('adt');
    let n = 3; t.textContent = n; el.classList.remove('hidden');
    const iv = setInterval(() => {
      n--; t.textContent = n;
      if (n <= 0) { clearInterval(iv); el.classList.add('hidden'); resolve(true); }
    }, 1000);
  });
}
