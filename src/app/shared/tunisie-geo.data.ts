/** Gouvernorats de Tunisie et leurs délégations (données administratives publiques). */
export interface GouvernoratTunisie {
  nom: string;
  delegations: string[];
}

export const GOUVERNORATS_TUNISIE: GouvernoratTunisie[] = [
  { nom: 'Ariana', delegations: ['Ariana Ville', 'Ettadhamen', 'Kalaat el-Andalous', 'La Soukra', 'Mnihla', 'Raoued', 'Sidi Thabet'] },
  { nom: 'Béja', delegations: ['Amdoun', 'Béja Nord', 'Béja Sud', 'Goubellat', 'Medjez el-Bab', 'Nefza', 'Téboursouk', 'Testour', 'Thibar'] },
  { nom: 'Ben Arous', delegations: ['Ben Arous', 'Bou Mhel el-Bassatine', 'El Mourouj', 'Ezzahra', 'Fouchana', 'Hammam Chott', 'Hammam Lif', 'Mégrine', 'Mohamedia', 'Mornag', 'Nouvelle Medina', 'Radès'] },
  { nom: 'Bizerte', delegations: ['Bizerte Nord', 'Bizerte Sud', 'Djoumine', 'El Alia', 'Ghar el-Melh', 'Ghezala', 'Mateur', 'Menzel Bourguiba', 'Menzel Jemil', 'Ras Jebel', 'Sejnane', 'Tinja', 'Utique', 'Zarzouna'] },
  { nom: 'Gabès', delegations: ['El Hamma', 'El Metouia', 'Gabès Médina', 'Gabès Ouest', 'Gabès Sud', 'Ghannouch', 'Mareth', 'Matmata', 'Menzel Habib', 'Nouvelle Matmata', 'Souk el-Jedid'] },
  { nom: 'Gafsa', delegations: ['Belkhir', 'El Guettar', 'El Ksar', 'Gafsa Nord', 'Gafsa Sud', 'Mdhilla', 'Métlaoui', 'Moularès', 'Redeyef', 'Sidi Aïch', 'Sened'] },
  { nom: 'Jendouba', delegations: ['Aïn Draham', 'Balta-Bou Aouane', 'Bou Salem', 'Fernana', 'Ghardimaou', 'Jendouba', 'Jendouba Nord', 'Oued Meliz', 'Tabarka'] },
  { nom: 'Kairouan', delegations: ['Bouhajla', 'Chebika', 'Echrarda', 'El Alaâ', 'Haffouz', 'Hajeb El Ayoun', 'Kairouan Nord', 'Kairouan Sud', 'Nasrallah', 'Oueslatia', 'Sbikha'] },
  { nom: 'Kasserine', delegations: ['El Ayoun', 'Ezzouhour', 'Fériana', 'Foussana', 'Hassi el-Ferid', 'Hidra', 'Jedelienne', 'Kasserine Nord', 'Kasserine Sud', 'Majel Bel Abbès', 'Sbeitla', 'Sbiba', 'Thala'] },
  { nom: 'Kébili', delegations: ['Douz Nord', 'Douz Sud', 'Faouar', 'Kébili Nord', 'Kébili Sud', 'Souk El Ahad'] },
  { nom: 'Le Kef', delegations: ['Dahmani', 'El Ksour', 'Jérissa', 'Kalaat Khasba', 'Kalaat Senan', 'Le Kef Est', 'Le Kef Ouest', 'Nebeur', 'Sakiet Sidi Youssef', 'Tajerouine', 'Touiref'] },
  { nom: 'Mahdia', delegations: ['Bou Merdes', 'Chebba', 'Chorbane', 'El Jem', 'Hebira', 'Ksour Essef', 'Mahdia', 'Melloulèche', 'Ouled Chamekh', 'Sidi Alouane', 'Souassi'] },
  { nom: 'Manouba', delegations: ['Borj El Amri', 'Douar Hicher', 'El Battan', 'Jedaida', 'Mannouba', 'Mornaguia', 'Oued Ellil', 'Tebourba'] },
  { nom: 'Médenine', delegations: ['Ben Gardane', 'Beni Khedache', 'Djerba Ajim', 'Djerba Houmt Souk', 'Djerba Midoun', 'Médenine Nord', 'Médenine Sud', 'Sidi Makhlouf', 'Zarzis'] },
  { nom: 'Monastir', delegations: ['Bekalta', 'Bembla', 'Beni Hassen', 'Jemmal', 'Ksar Hellal', 'Ksibet el-Médiouni', 'Monastir', 'Moknine', 'Ouerdanine', 'Sahline', 'Sayada-Lamta-Bou Hajar', 'Téboulba', 'Zéramdine'] },
  { nom: 'Nabeul', delegations: ['Béni Khalled', 'Béni Khiar', 'Bou Argoub', 'Dar Chaabane', 'El Haouaria', 'El Mida', 'Grombalia', 'Hammamet', 'Kélibia', 'Korba', 'Menzel Bouzelfa', 'Menzel Temime', 'Nabeul', 'Soliman', 'Takelsa'] },
  { nom: 'Sfax', delegations: ['Agareb', 'Bir Ali Ben Khalifa', 'El Amra', 'El Hencha', 'Ghraiba', 'Jebiniana', 'Kerkennah', 'Mahres', 'Menzel Chaker', 'Sakiet Eddaïer', 'Sakiet Ezzit', 'Sfax Ouest', 'Sfax Sud', 'Sfax Ville', 'Skhira', 'Thyna'] },
  { nom: 'Sidi Bouzid', delegations: ['Bir El Hafey', 'Cebbala Ouled Asker', 'Jilma', 'Menzel Bouzaiane', 'Meknassy', 'Mezzouna', 'Ouled Haffouz', 'Regueb', 'Sidi Ali Ben Aoun', 'Sidi Bouzid Est', 'Sidi Bouzid Ouest', 'Souk Jedid'] },
  { nom: 'Siliana', delegations: ['Bargou', 'Bou Arada', 'El Aroussa', 'El Krib', 'Gaâfour', 'Kesra', 'Makthar', 'Rouhia', 'Sidi Bou Rouis', 'Siliana Nord', 'Siliana Sud'] },
  { nom: 'Sousse', delegations: ['Akouda', 'Bouficha', 'Enfida', 'Hammam Sousse', 'Hergla', 'Kalâa Kebira', 'Kalâa Seghira', 'Kondar', 'M\'saken', 'Sidi Bou Ali', 'Sidi El Hani', 'Sousse Jawhara', 'Sousse Médina', 'Sousse Riadh', 'Sousse Sidi Abdelhamid'] },
  { nom: 'Tataouine', delegations: ['Bir Lahmar', 'Dhehiba', 'Ghomrassen', 'Remada', 'Smar', 'Tataouine Nord', 'Tataouine Sud'] },
  { nom: 'Tozeur', delegations: ['Degache', 'Hazoua', 'Nefta', 'Tameghza', 'Tozeur'] },
  { nom: 'Tunis', delegations: ['Bab Bhar', 'Bab Souika', 'Carthage', 'Cité El Khadra', 'Djebel Jelloud', 'El Kabaria', 'El Menzah', 'El Omrane', 'El Omrane Supérieur', 'El Ouardia', 'Ettahrir', 'Ezzouhour', 'Hraïria', 'La Goulette', 'La Marsa', 'Le Bardo', 'Médina', 'Séjoumi', 'Sidi El Béchir', 'Sidi Hassine'] },
  { nom: 'Zaghouan', delegations: ['Bir Mcherga', 'El Fahs', 'Nadhour', 'Saouaf', 'Zaghouan', 'Zriba'] }
];

export function delegationsPourGouvernorat(gouvernorat: string | null | undefined): string[] {
  if (!gouvernorat) return [];
  const trouve = GOUVERNORATS_TUNISIE.find(g => g.nom === gouvernorat);
  return trouve ? trouve.delegations : [];
}
