export const environment = {
  production: false,
  apiUrl: 'https://caisse-backend-1.onrender.com/api',
  //apiUrl: 'https://caisse-backend-mn10.onrender.com/api',
  // Doit pointer sur le même backend que `apiUrl` (sans /api) : sinon les images
  // servies en chemin relatif (/uploads/...) ne se résolvent pas. Les nouvelles
  // images produits/packs sont sur R2 en URL absolue et ignorent cette valeur.
  fileBaseUrl: 'https://caisse-backend-1.onrender.com',
  // Client ID PUBLIC (pas un secret) du widget "Continuer avec Google" (voir app/login/). Vide
  // par défaut : le bouton Google reste alors masqué plutôt que d'échouer (voir
  // login.component.ts#initGoogle). À renseigner avec le Client ID créé sur
  // console.cloud.google.com (instructions dans backend/.env, section GOOGLE_CLIENT_ID) — même
  // valeur ici et dans environment.prod.ts, et côté backend (GOOGLE_CLIENT_ID) pour vérifier les
  // jetons émis par ce widget.
  googleClientId: '519304894567-bncec8d2hlavp0i2l47fm2knmhd36a14.apps.googleusercontent.com'
};
