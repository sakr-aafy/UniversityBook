/**
 * Normalise l'affichage d'un libellé de catégorie/sous-catégorie saisi en caisse (texte libre,
 * casse jamais garantie — "LIVRE", "COLLE", "cahier" coexistent dans les mêmes données réelles) en
 * casse "Phrase" lisible, sans jamais modifier la valeur elle-même (utilisée telle quelle dans les
 * queryParams pour le filtrage). Volontairement en JS plutôt qu'en CSS `::first-letter` : ce
 * pseudo-élément ne s'applique pas aux conteneurs flex, incompatible avec `.ub-boutique-menu-item`.
 */
export function formatCategorieLabel(nom: string | null | undefined): string {
  const s = (nom || '').trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
