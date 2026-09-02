export const environment = {
  production: false,
  apiUrl: 'https://caisse-backend-1.onrender.com/api',
  //apiUrl: 'https://caisse-backend-mn10.onrender.com/api',
  // Doit pointer sur le même backend que `apiUrl` (sans /api) : sinon les images
  // servies en chemin relatif (/uploads/...) ne se résolvent pas. Les nouvelles
  // images produits/packs sont sur R2 en URL absolue et ignorent cette valeur.
  fileBaseUrl: 'https://caisse-backend-1.onrender.com'
};
