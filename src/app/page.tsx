"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";

type Eleve = {
  id: number;
  prenom: string;
  nom: string;
  sexe: string;
};

type Place = {
  id: number;
  x: number;
  y: number;
  eleveId: number | null;
  verrouillee: boolean;
};

type ContrainteSeparation = {
  id: number;
  eleve1Id: number;
  eleve2Id: number;
};

type GroupeProximite = {
  id: number;
  eleveIds: number[];
};

type ModeSalle = "classique" | "libre";

type VueExport = "aerienne" | "professeur";

type Projet = {
  id: string;
  nom: string;
  eleves: Eleve[];
  places: Place[];
  contraintes: ContrainteSeparation[];
  groupesProximite?: GroupeProximite[];
  elevesDevant: number[];
  modeSalle?: ModeSalle;
  grilleSuiviActive?: boolean;
  nombreCasesSuivi?: number;
  binomesMixtesActifs?: boolean;
  dateModification: string;
};

type Vue = "classes" | "plan" | "salle" | "eleves";

type StatutSauvegarde = "enregistrement" | "enregistre";

type ZoneSalle = "gauche" | "centre" | "droite";

type ScoreBinomes = {
  mixtes: number;
  possibles: number;
};

type EvaluationPlan = {
  violationsSeparation: number;
  violationsGroupement: number;
  violationsDevant: number;
  mixtes: number;
};

type RectangleSelection = {
  debutX: number;
  debutY: number;
  finX: number;
  finY: number;
};

type EtatSalleHistorique = {
  places: Place[];
  modeSalle: ModeSalle;
};

const CLE_PROJETS = "plan-de-classe-projets-v2";

const LARGEUR_TABLE = 8;
const HAUTEUR_TABLE = 12;

const LIMITE_ZONE_DEVANT = 32;

const EMPLACEMENTS_GAUCHE = [8, 16, 24];
const EMPLACEMENTS_CENTRE = [38, 46, 54, 62];
const EMPLACEMENTS_DROITE = [76, 84, 92];

const FRONTIERE_GAUCHE_CENTRE = 31;
const FRONTIERE_CENTRE_DROITE = 69;

const POINTS_X = Array.from({ length: 87 }, (_, index) => 7 + index);

// La grille libre va désormais presque jusqu'en haut et en bas de la salle.
// En déposant une table sur une nouvelle ligne à 6 % ou 94 %, le nombre de
// rangées visibles augmente et la hauteur de la surface s’agrandit automatiquement.
const POINTS_Y = Array.from({ length: 23 }, (_, index) => 6 + index * 4);

function creerIdentifiant(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return String(Date.now() + Math.random());
}

function melangerTableau<T>(tableau: T[]): T[] {
  const resultat = [...tableau];

  for (let i = resultat.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    const temporaire = resultat[i];
    resultat[i] = resultat[j];
    resultat[j] = temporaire;
  }

  return resultat;
}

function positionsYPourNombreRangees(nombreRangees: number): number[] {
  const nombre = Math.max(1, Math.min(8, nombreRangees));

  if (nombre === 1) {
    return [50];
  }

  const debut = 14;
  const fin = 89;
  const pas = (fin - debut) / (nombre - 1);

  return Array.from({ length: nombre }, function (_, index) {
    return debut + index * pas;
  });
}

function creerDispositionClassique(nombreRangees = 6): Place[] {
  const positionsX = [
    8, 16,

    38, 46, 54, 62,

    84, 92,
  ];

  const positionsY = positionsYPourNombreRangees(nombreRangees);
  const places: Place[] = [];

  let id = 1;

  positionsY.forEach(function (y) {
    positionsX.forEach(function (x) {
      places.push({
        id,
        x,
        y,
        eleveId: null,
        verrouillee: false,
      });

      id++;
    });
  });

  return places;
}

function creerDisposition232(nombreRangees = 6): Place[] {
  const positionsX = [
    8, 16,

    42, 50, 58,

    84, 92,
  ];

  const positionsY = positionsYPourNombreRangees(nombreRangees);
  const places: Place[] = [];

  let id = 1;

  positionsY.forEach(function (y) {
    positionsX.forEach(function (x) {
      places.push({
        id,
        x,
        y,
        eleveId: null,
        verrouillee: false,
      });

      id++;
    });
  });

  return places;
}

function creerDisposition222(nombreRangees = 6): Place[] {
  const positionsX = [
    8, 16,

    46, 54,

    84, 92,
  ];

  const positionsY = positionsYPourNombreRangees(nombreRangees);
  const places: Place[] = [];

  let id = 1;

  positionsY.forEach(function (y) {
    positionsX.forEach(function (x) {
      places.push({
        id,
        x,
        y,
        eleveId: null,
        verrouillee: false,
      });

      id++;
    });
  });

  return places;
}

function creerDisposition44(nombreRangees = 6): Place[] {
  const positionsX = [18, 26, 34, 42, 58, 66, 74, 82];
  const positionsY = positionsYPourNombreRangees(nombreRangees);
  const places: Place[] = [];

  let id = 1;

  positionsY.forEach(function (y) {
    positionsX.forEach(function (x) {
      places.push({
        id,
        x,
        y,
        eleveId: null,
        verrouillee: false,
      });

      id++;
    });
  });

  return places;
}

function creerDispositionIlots4(): Place[] {
  const positions: { x: number; y: number }[] = [];

  // 9 îlots de 4 = 36 places.
  // Les cartes sont presque bord à bord : 6 unités horizontalement et
  // 12 verticalement. Ces valeurs sont également autorisées par le glisser-
  // déposer, ce qui permet de sortir puis de recoller une table à son îlot.
  [20, 50, 80].forEach(function (centreX) {
    [20, 50, 80].forEach(function (centreY) {
      [-3, 3].forEach(function (dx) {
        [-6, 6].forEach(function (dy) {
          positions.push({
            x: centreX + dx,
            y: centreY + dy,
          });
        });
      });
    });
  });

  return positions.map(function (position, index) {
    return {
      id: index + 1,
      x: position.x,
      y: position.y,
      eleveId: null,
      verrouillee: false,
    };
  });
}

function creerDispositionIlots5(): Place[] {
  const positions: { x: number; y: number }[] = [];

  // 7 îlots de 5 = 35 places.
  // Deux tables en haut et trois en bas. Les cartes sont compactes et utilisent
  // les mêmes espacements que le système de glisser-déposer.
  const centres = [
    { x: 20, y: 20 },
    { x: 50, y: 20 },
    { x: 80, y: 20 },
    { x: 35, y: 50 },
    { x: 65, y: 50 },
    { x: 35, y: 80 },
    { x: 65, y: 80 },
  ];

  centres.forEach(function (centre) {
    positions.push({ x: centre.x - 3, y: centre.y - 6 });
    positions.push({ x: centre.x + 3, y: centre.y - 6 });

    positions.push({ x: centre.x - 6, y: centre.y + 6 });
    positions.push({ x: centre.x, y: centre.y + 6 });
    positions.push({ x: centre.x + 6, y: centre.y + 6 });
  });

  return positions.map(function (position, index) {
    return {
      id: index + 1,
      x: position.x,
      y: position.y,
      eleveId: null,
      verrouillee: false,
    };
  });
}


function creerDispositionDeuxU(): Place[] {
  const positions: { x: number; y: number }[] = [];

  // U extérieur, ouvert vers le tableau : 17 places.
  [16, 28, 40, 52, 64].forEach(function (y) {
    positions.push({ x: 14, y });
    positions.push({ x: 86, y });
  });

  [26, 34, 42, 50, 58, 66, 74].forEach(function (x) {
    positions.push({ x, y: 80 });
  });

  // U intérieur : 8 places. Total = 25.
  [32, 44, 56].forEach(function (y) {
    positions.push({ x: 34, y });
    positions.push({ x: 66, y });
  });

  [46, 54].forEach(function (x) {
    positions.push({ x, y: 68 });
  });

  return positions.map(function (position, index) {
    return {
      id: index + 1,
      x: position.x,
      y: position.y,
      eleveId: null,
      verrouillee: false,
    };
  });
}

function creerDispositionU(): Place[] {
  const positions: { x: number; y: number }[] = [];

  // 24 places environ : 8 sur chaque côté et 8 au fond.
  [12, 20, 28, 36, 44, 52, 60, 68].forEach(function (y) {
    positions.push({
      x: 20,
      y,
    });

    positions.push({
      x: 84,
      y,
    });
  });

  [28, 36, 44, 52, 60, 68, 76, 84].forEach(function (x) {
    positions.push({
      x,
      y: 80,
    });
  });

  return positions.map(function (position, index) {
    return {
      id: index + 1,
      x: position.x,
      y: position.y,
      eleveId: null,
      verrouillee: false,
    };
  });
}

function creerDispositionRangeesSimples(): Place[] {
  // 7 rangées de 6 tables = 42 places.
  // Les tables sont jointives horizontalement : l’utilisateur peut ensuite
  // déplacer une colonne ou un groupe pour fabriquer ses propres couloirs.
  const positionsX = [30, 38, 46, 54, 62, 70];
  const positionsY = positionsYPourNombreRangees(7);
  const places: Place[] = [];

  let id = 1;

  positionsY.forEach(function (y) {
    positionsX.forEach(function (x) {
      places.push({
        id,
        x,
        y,
        eleveId: null,
        verrouillee: false,
      });

      id++;
    });
  });

  return places;
}

function estFille(eleve: Eleve): boolean {
  const sexe = eleve.sexe.trim().toLowerCase();

  return sexe === "f" || sexe === "fille" || sexe === "female";
}

function estGarcon(eleve: Eleve): boolean {
  const sexe = eleve.sexe.trim().toLowerCase();

  return (
    sexe === "m" ||
    sexe === "g" ||
    sexe === "garçon" ||
    sexe === "garcon" ||
    sexe === "male"
  );
}

function normaliserSexeImport(valeur: unknown): string {
  const texte = String(valeur ?? "").trim().toLocaleLowerCase("fr-FR");

  if (["f", "féminin", "feminin", "fille", "female"].includes(texte)) {
    return "F";
  }

  if (["m", "masculin", "garçon", "garcon", "male"].includes(texte)) {
    return "M";
  }

  return String(valeur ?? "").trim();
}

function separerNomPrenomEnseignant(valeur: unknown): {
  nom: string;
  prenom: string;
} {
  const texte = String(valeur ?? "").trim().replace(/\s+/g, " ");

  if (!texte) {
    return { nom: "", prenom: "" };
  }

  const morceaux = texte.split(" ");
  let premierPrenom = morceaux.findIndex(function (morceau) {
    if (morceau === "--" || morceau === "-" || morceau === "/") {
      return false;
    }

    const contientLettre = morceau.toLocaleLowerCase("fr-FR") !== morceau.toLocaleUpperCase("fr-FR");
    const estMajuscule = morceau === morceau.toLocaleUpperCase("fr-FR");

    return contientLettre && !estMajuscule;
  });

  if (premierPrenom < 0) {
    premierPrenom = morceaux.length;
  }

  return {
    nom: morceaux.slice(0, premierPrenom).join(" ").trim(),
    prenom: morceaux.slice(premierPrenom).join(" ").trim(),
  };
}

function nomCourt(eleve: Eleve, eleves: Eleve[]): string {
  if (!eleve.nom.trim()) {
    return eleve.prenom;
  }

  const memePrenom = eleves.filter(function (autre) {
    return (
      autre.id !== eleve.id &&
      autre.prenom.toLowerCase() === eleve.prenom.toLowerCase()
    );
  });

  if (memePrenom.length === 0) {
    return eleve.prenom + " " + eleve.nom.substring(0, 1) + ".";
  }

  for (let longueur = 1; longueur <= eleve.nom.length; longueur++) {
    const debut = eleve.nom.substring(0, longueur).toLowerCase();

    const conflit = memePrenom.some(function (autre) {
      return autre.nom.substring(0, longueur).toLowerCase() === debut;
    });

    if (!conflit) {
      return eleve.prenom + " " + eleve.nom.substring(0, longueur) + ".";
    }
  }

  return eleve.prenom + " " + eleve.nom;
}

function determinerZone(x: number): ZoneSalle {
  if (x < FRONTIERE_GAUCHE_CENTRE) {
    return "gauche";
  }

  if (x > FRONTIERE_CENTRE_DROITE) {
    return "droite";
  }

  return "centre";
}

function capaciteZone(zone: ZoneSalle): number {
  return zone === "centre" ? 5 : 3;
}

function positionsPourBloc(zone: ZoneSalle, nombre: number): number[] {
  if (nombre <= 0) {
    return [];
  }

  /*
    BLOC GAUCHE
    Toujours aligné vers le mur extérieur.
  */
  if (zone === "gauche") {
    if (nombre === 1) {
      return [8];
    }

    if (nombre === 2) {
      return [8, 16];
    }

    return [8, 16, 24];
  }

  /*
    BLOC DROIT
    Symétrique du bloc gauche.
  */
  if (zone === "droite") {
    if (nombre === 1) {
      return [92];
    }

    if (nombre === 2) {
      return [84, 92];
    }

    return [76, 84, 92];
  }

  /*
    BLOC CENTRAL

    1 table  :              50
    2 tables :          46      54
    3 tables :      42      50      58
    4 tables :   38      46      54      62

    Pour 5 tables, on resserre légèrement :
              36   43   50   57   64

    Cela reste parfaitement centré tout en conservant
    un espace correct avec les blocs extérieurs.
  */
  if (nombre === 1) {
    return [50];
  }

  if (nombre === 2) {
    return [46, 54];
  }

  if (nombre === 3) {
    return [42, 50, 58];
  }

  if (nombre === 4) {
    return [38, 46, 54, 62];
  }

  if (nombre === 5) {
    return [36, 43, 50, 57, 64];
  }

  return [];
}

function tablesDuBloc(places: Place[], y: number, zone: ZoneSalle): Place[] {
  return places
    .filter(function (place) {
      return Math.abs(place.y - y) < 0.6 && determinerZone(place.x) === zone;
    })
    .sort(function (a, b) {
      return a.x - b.x;
    });
}

function normaliserBloc(places: Place[], y: number, zone: ZoneSalle): Place[] {
  const bloc = tablesDuBloc(places, y, zone);

  if (bloc.length === 0 || bloc.length > capaciteZone(zone)) {
    return places;
  }

  const positions = positionsPourBloc(zone, bloc.length);

  const positionParId = new Map<number, number>();

  bloc.forEach(function (place, index) {
    positionParId.set(place.id, positions[index]);
  });

  return places.map(function (place) {
    const nouvellePosition = positionParId.get(place.id);

    if (nouvellePosition === undefined) {
      return place;
    }

    return {
      ...place,
      x: nouvellePosition,
      y,
    };
  });
}

function normaliserRangee(places: Place[], y: number): Place[] {
  let resultat = places;

  resultat = normaliserBloc(resultat, y, "gauche");

  resultat = normaliserBloc(resultat, y, "centre");

  resultat = normaliserBloc(resultat, y, "droite");

  return resultat;
}

function normaliserToutesLesRangees(places: Place[]): Place[] {
  const valeursY = Array.from(
    new Set(
      places.map(function (place) {
        return place.y;
      }),
    ),
  );

  let resultat = places.map(function (place) {
    return { ...place };
  });

  valeursY.forEach(function (y) {
    resultat = normaliserRangee(resultat, y);
  });

  return resultat;
}

function deplacerTableClassique(
  places: Place[],
  tableId: number,
  destinationY: number,
  destinationZone: ZoneSalle,
  positionSourisX: number,
): Place[] | null {
  const table = places.find(function (place) {
    return place.id === tableId;
  });

  if (!table) {
    return null;
  }

  const departY = table.y;

  const departZone = determinerZone(table.x);

  const tablesDestination = tablesDuBloc(
    places.filter(function (place) {
      return place.id !== tableId;
    }),
    destinationY,
    destinationZone,
  );

  if (tablesDestination.length >= capaciteZone(destinationZone)) {
    return null;
  }

  if (
    Math.abs(departY - destinationY) < 0.6 &&
    departZone === destinationZone
  ) {
    return normaliserBloc(
      places.map(function (place) {
        return { ...place };
      }),
      departY,
      departZone,
    );
  }

  let resultat = places.map(function (place) {
    if (place.id !== tableId) {
      return { ...place };
    }

    return {
      ...place,
      x: positionSourisX,
      y: destinationY,
    };
  });

  resultat = normaliserBloc(resultat, departY, departZone);

  resultat = normaliserBloc(resultat, destinationY, destinationZone);

  return resultat;
}

function trouverRangeeProche(y: number, places: Place[]): number | null {
  if (places.length === 0) {
    return null;
  }

  const valeursY = Array.from(
    new Set(
      places.map(function (place) {
        return place.y;
      }),
    ),
  );

  let meilleurY = valeursY[0];

  let meilleureDistance = Math.abs(valeursY[0] - y);

  valeursY.forEach(function (valeurY) {
    const distance = Math.abs(valeurY - y);

    if (distance < meilleureDistance) {
      meilleurY = valeurY;
      meilleureDistance = distance;
    }
  });

  if (meilleureDistance > 6) {
    return null;
  }

  return meilleurY;
}

function distanceEntreTables(place1: Place, place2: Place) {
  const dx = Math.abs(place1.x - place2.x) / LARGEUR_TABLE;

  const dy = Math.abs(place1.y - place2.y) / HAUTEUR_TABLE;

  return {
    dx,
    dy,

    distance: Math.sqrt(dx * dx + dy * dy),
  };
}

function memeLigne(place1: Place, place2: Place): boolean {
  return Math.abs(place1.y - place2.y) <= HAUTEUR_TABLE * 0.45;
}

function tableEntreHorizontalement(
  place1: Place,
  place2: Place,
  places: Place[],
): boolean {
  if (!memeLigne(place1, place2)) {
    return false;
  }

  const minimumX = Math.min(place1.x, place2.x);

  const maximumX = Math.max(place1.x, place2.x);

  return places.some(function (autre) {
    if (autre.id === place1.id || autre.id === place2.id) {
      return false;
    }

    return (
      Math.abs(autre.y - place1.y) <= HAUTEUR_TABLE * 0.45 &&
      autre.x > minimumX &&
      autre.x < maximumX
    );
  });
}

function tableEntreVerticalement(
  place1: Place,
  place2: Place,
  places: Place[],
): boolean {
  if (Math.abs(place1.x - place2.x) > LARGEUR_TABLE * 0.7) {
    return false;
  }

  const minimumY = Math.min(place1.y, place2.y);

  const maximumY = Math.max(place1.y, place2.y);

  return places.some(function (autre) {
    if (autre.id === place1.id || autre.id === place2.id) {
      return false;
    }

    return (
      Math.abs(autre.x - place1.x) <= LARGEUR_TABLE * 0.7 &&
      autre.y > minimumY &&
      autre.y < maximumY
    );
  });
}

function placesTropProches(
  place1: Place,
  place2: Place,
  places: Place[],
): boolean {
  const mesure = distanceEntreTables(place1, place2);

  if (mesure.distance <= 1.55) {
    return true;
  }

  if (
    memeLigne(place1, place2) &&
    mesure.dx <= 4.2 &&
    !tableEntreHorizontalement(place1, place2, places)
  ) {
    return true;
  }

  if (
    mesure.dx <= 0.7 &&
    mesure.dy <= 2.4 &&
    !tableEntreVerticalement(place1, place2, places)
  ) {
    return true;
  }

  if (mesure.dy <= 1.7 && mesure.dx <= 2.25) {
    return true;
  }

  return false;
}

function trouverBinomes(places: Place[]): Place[][] {
  const candidats: {
    place1: Place;
    place2: Place;
    distance: number;
  }[] = [];

  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const mesure = distanceEntreTables(places[i], places[j]);

      // Pour l'alternance fille / garçon, chaque voisinage horizontal compte.
      // Sur une rangée de 3 tables, on évalue donc 1-2 ET 2-3 ; sur 4 tables,
      // 1-2, 2-3 et 3-4. On ne découpe plus la rangée en binômes disjoints.
      if (memeLigne(places[i], places[j]) && mesure.distance <= 1.25) {
        candidats.push({
          place1: places[i],
          place2: places[j],
          distance: mesure.distance,
        });
      }
    }
  }

  candidats.sort(function (a, b) {
    if (Math.abs(a.place1.y - b.place1.y) > 0.5) {
      return a.place1.y - b.place1.y;
    }

    return Math.min(a.place1.x, a.place2.x) - Math.min(b.place1.x, b.place2.x);
  });

  return candidats.map(function (candidat) {
    return [candidat.place1, candidat.place2];
  });
}

function calculerScoreBinomes(eleves: Eleve[], places: Place[]): ScoreBinomes {
  const elevesParId = new Map<number, Eleve>();

  eleves.forEach(function (eleve) {
    elevesParId.set(eleve.id, eleve);
  });

  const voisinages = trouverBinomes(places);

  let mixtes = 0;
  let possibles = 0;

  voisinages.forEach(function (voisinage) {
    const eleve1 =
      voisinage[0].eleveId === null
        ? null
        : (elevesParId.get(voisinage[0].eleveId) ?? null);

    const eleve2 =
      voisinage[1].eleveId === null
        ? null
        : (elevesParId.get(voisinage[1].eleveId) ?? null);

    if (!eleve1 || !eleve2) {
      return;
    }

    // On ne compte dans l'indicateur que les voisinages pour lesquels le sexe
    // est renseigné. Ainsi 3 tables occupées peuvent afficher 2/2, et 4 tables
    // occupées 3/3 lorsque l'alternance est parfaite.
    const sexe1Connu = estFille(eleve1) || estGarcon(eleve1);
    const sexe2Connu = estFille(eleve2) || estGarcon(eleve2);

    if (!sexe1Connu || !sexe2Connu) {
      return;
    }

    possibles++;

    if (
      (estFille(eleve1) && estGarcon(eleve2)) ||
      (estGarcon(eleve1) && estFille(eleve2))
    ) {
      mixtes++;
    }
  });

  return {
    mixtes,
    possibles,
  };
}

function contraintesNonRespectees(
  contraintes: ContrainteSeparation[],
  places: Place[],
): ContrainteSeparation[] {
  const placeParEleve = new Map<number, Place>();

  places.forEach(function (place) {
    if (place.eleveId !== null) {
      placeParEleve.set(place.eleveId, place);
    }
  });

  return contraintes.filter(function (contrainte) {
    const place1 = placeParEleve.get(contrainte.eleve1Id);

    const place2 = placeParEleve.get(contrainte.eleve2Id);

    if (!place1 || !place2) {
      return false;
    }

    return placesTropProches(place1, place2, places);
  });
}

function groupesProximiteNonRespectes(
  groupes: GroupeProximite[],
  places: Place[],
): GroupeProximite[] {
  const placeParEleve = new Map<number, Place>();

  places.forEach(function (place) {
    if (place.eleveId !== null) {
      placeParEleve.set(place.eleveId, place);
    }
  });

  return groupes.filter(function (groupe) {
    const membres = groupe.eleveIds
      .map(function (id) {
        return placeParEleve.get(id) ?? null;
      })
      .filter(function (place): place is Place {
        return place !== null;
      });

    if (membres.length !== groupe.eleveIds.length || membres.length < 2) {
      return true;
    }

    // Un binôme doit être voisin. Pour un trinôme, on accepte une petite
    // chaîne de trois places voisines (A près de B, B près de C).
    const visites = new Set<number>([membres[0].id]);
    const aExplorer = [membres[0]];

    while (aExplorer.length > 0) {
      const actuelle = aExplorer.shift()!;

      membres.forEach(function (autre) {
        if (visites.has(autre.id) || autre.id === actuelle.id) {
          return;
        }

        if (placesTropProches(actuelle, autre, places)) {
          visites.add(autre.id);
          aExplorer.push(autre);
        }
      });
    }

    return visites.size !== membres.length;
  });
}

function elevesDevantNonRespectes(
  elevesDevant: number[],
  places: Place[],
): number[] {
  const placeParEleve = new Map<number, Place>();

  places.forEach(function (place) {
    if (place.eleveId !== null) {
      placeParEleve.set(place.eleveId, place);
    }
  });

  const rangees = Array.from(
    new Set(
      places.map(function (place) {
        return place.y;
      }),
    ),
  ).sort(function (a, b) {
    return a - b;
  });

  const rangeesDevant = rangees.slice(0, 2);

  return elevesDevant.filter(function (eleveId) {
    const place = placeParEleve.get(eleveId);

    if (!place) {
      return true;
    }

    return !rangeesDevant.some(function (y) {
      return Math.abs(place.y - y) < 0.6;
    });
  });
}

function obtenirElevesVerrouilles(places: Place[]): Set<number> {
  const resultat = new Set<number>();

  places.forEach(function (place) {
    if (place.verrouillee && place.eleveId !== null) {
      resultat.add(place.eleveId);
    }
  });

  return resultat;
}

/*
  Le placement intelligent ne doit pas disperser
  inutilement les élèves dans toute la salle.

  On sélectionne donc d'abord les places les plus
  proches du tableau.

  Les places verrouillées restent toujours actives.
*/
function choisirPlacesActivesVersAvant(
  eleves: Eleve[],
  places: Place[],
): Set<number> {
  const nombreAPlacer = Math.min(eleves.length, places.length);

  const verrouillees = places.filter(function (place) {
    return place.verrouillee && place.eleveId !== null;
  });

  const idsActifs = new Set<number>(
    verrouillees.map(function (place) {
      return place.id;
    }),
  );

  // On ne réserve plus les places par paires. Cette ancienne logique pouvait
  // laisser volontairement une table vide au milieu d'un bloc de 3 tables.
  // Désormais on remplit simplement les meilleures places, de l'avant vers le
  // fond, en privilégiant les tables centrales d'une même rangée. L'alternance
  // fille / garçon est gérée ensuite, sans créer de trous artificiels.
  const restantes = places
    .filter(function (place) {
      return !idsActifs.has(place.id);
    })
    .sort(function (a, b) {
      if (Math.abs(a.y - b.y) > 0.5) {
        return a.y - b.y;
      }

      return Math.abs(a.x - 50) - Math.abs(b.x - 50);
    });

  const nombreRestant = Math.max(0, nombreAPlacer - idsActifs.size);

  restantes.slice(0, nombreRestant).forEach(function (place) {
    idsActifs.add(place.id);
  });

  return idsActifs;
}

function genererPlanMixte(
  eleves: Eleve[],
  places: Place[],
  binomesMixtesActifs: boolean,
): Place[] {
  const placesActives = choisirPlacesActivesVersAvant(eleves, places);

  const nouvellesPlaces = places.map(function (place) {
    return {
      ...place,
      eleveId: place.verrouillee ? place.eleveId : null,
    };
  });

  const elevesVerrouilles = obtenirElevesVerrouilles(places);

  const disponibles = eleves.filter(function (eleve) {
    return !elevesVerrouilles.has(eleve.id);
  });

  // Sans règle mixte, on conserve un placement aléatoire qui laisse ensuite
  // l'optimiseur choisir le meilleur candidat pour les autres contraintes.
  if (!binomesMixtesActifs) {
    const melanges = melangerTableau(disponibles);
    const placesDisponibles = nouvellesPlaces
      .filter(function (place) {
        return placesActives.has(place.id) && place.eleveId === null;
      })
      .sort(function (a, b) {
        if (Math.abs(a.y - b.y) > 0.5) {
          return a.y - b.y;
        }

        return a.x - b.x;
      });

    placesDisponibles.forEach(function (place, index) {
      const eleve = melanges[index];
      if (eleve) {
        place.eleveId = eleve.id;
      }
    });

    return nouvellesPlaces;
  }

  const filles = melangerTableau(disponibles.filter(estFille));
  const garcons = melangerTableau(disponibles.filter(estGarcon));
  const autres = melangerTableau(
    disponibles.filter(function (eleve) {
      return !estFille(eleve) && !estGarcon(eleve);
    }),
  );

  const elevesParId = new Map<number, Eleve>();
  eleves.forEach(function (eleve) {
    elevesParId.set(eleve.id, eleve);
  });

  function retirerDeListe(liste: Eleve[]): Eleve | null {
    return liste.shift() ?? null;
  }

  function retirerNimporteLequel(): Eleve | null {
    const listesDisponibles = [filles, garcons, autres].filter(function (liste) {
      return liste.length > 0;
    });

    if (listesDisponibles.length === 0) {
      return null;
    }

    const liste = listesDisponibles[Math.floor(Math.random() * listesDisponibles.length)];
    return retirerDeListe(liste);
  }

  function sexeDe(eleve: Eleve | null): "F" | "M" | null {
    if (!eleve) {
      return null;
    }

    if (estFille(eleve)) {
      return "F";
    }

    if (estGarcon(eleve)) {
      return "M";
    }

    return null;
  }

  function retirerPourSexe(sexeSouhaite: "F" | "M" | null): Eleve | null {
    if (sexeSouhaite === "F" && filles.length > 0) {
      return retirerDeListe(filles);
    }

    if (sexeSouhaite === "M" && garcons.length > 0) {
      return retirerDeListe(garcons);
    }

    // Si l'alternance demandée n'est plus possible, on privilégie le sexe
    // encore disponible en plus grand nombre avant d'utiliser les valeurs non
    // renseignées. Cela évite de laisser une place vide pour sauver un binôme.
    if (filles.length > 0 || garcons.length > 0) {
      if (filles.length === garcons.length) {
        return Math.random() < 0.5
          ? retirerDeListe(filles) ?? retirerDeListe(garcons)
          : retirerDeListe(garcons) ?? retirerDeListe(filles);
      }

      return filles.length > garcons.length
        ? retirerDeListe(filles)
        : retirerDeListe(garcons);
    }

    return retirerNimporteLequel();
  }

  // On regroupe les places actives en segments horizontaux continus. Un bloc de
  // 3 tables est donc traité comme une suite de 3 positions, et un bloc de 4
  // comme une suite de 4. C'est cette suite entière que l'on cherche à alterner.
  const activesTriees = nouvellesPlaces
    .filter(function (place) {
      return placesActives.has(place.id);
    })
    .sort(function (a, b) {
      if (Math.abs(a.y - b.y) > 0.5) {
        return a.y - b.y;
      }

      return a.x - b.x;
    });

  const segments: Place[][] = [];

  activesTriees.forEach(function (place) {
    const dernierSegment = segments[segments.length - 1];
    const dernierePlace = dernierSegment?.[dernierSegment.length - 1];

    if (
      dernierePlace &&
      memeLigne(dernierePlace, place) &&
      Math.abs(place.x - dernierePlace.x) <= LARGEUR_TABLE * 1.35
    ) {
      dernierSegment.push(place);
    } else {
      segments.push([place]);
    }
  });

  segments.forEach(function (segment) {
    segment.forEach(function (place, index) {
      if (place.eleveId !== null) {
        return;
      }

      const precedente = index > 0 ? segment[index - 1] : null;
      const suivante = index + 1 < segment.length ? segment[index + 1] : null;

      const elevePrecedent =
        precedente?.eleveId === null || precedente?.eleveId === undefined
          ? null
          : (elevesParId.get(precedente.eleveId) ?? null);

      const eleveSuivantFixe =
        suivante?.verrouillee && suivante.eleveId !== null
          ? (elevesParId.get(suivante.eleveId) ?? null)
          : null;

      const sexePrecedent = sexeDe(elevePrecedent);
      const sexeSuivantFixe = sexeDe(eleveSuivantFixe);

      let sexeSouhaite: "F" | "M" | null = null;

      if (sexePrecedent === "F") {
        sexeSouhaite = "M";
      } else if (sexePrecedent === "M") {
        sexeSouhaite = "F";
      } else if (sexeSuivantFixe === "F") {
        sexeSouhaite = "M";
      } else if (sexeSuivantFixe === "M") {
        sexeSouhaite = "F";
      } else if (filles.length > 0 && garcons.length > 0) {
        // Pour le premier siège d'un segment, on varie le sexe de départ entre
        // les candidats afin de laisser de la liberté aux autres contraintes.
        sexeSouhaite = Math.random() < 0.5 ? "F" : "M";
      }

      const choisi = retirerPourSexe(sexeSouhaite);

      if (choisi) {
        place.eleveId = choisi.id;
      }
    });
  });

  // Cas de secours : toute place active encore vide reçoit un élève restant.
  // En pratique ce bloc ne sert que si une géométrie très particulière a été
  // bricolée en mode libre.
  nouvellesPlaces
    .filter(function (place) {
      return placesActives.has(place.id) && place.eleveId === null;
    })
    .forEach(function (place) {
      const choisi = retirerNimporteLequel();
      if (choisi) {
        place.eleveId = choisi.id;
      }
    });

  return nouvellesPlaces;
}

function evaluerPlan(
  eleves: Eleve[],
  places: Place[],
  contraintes: ContrainteSeparation[],
  groupesProximite: GroupeProximite[],
  elevesDevant: number[],
  binomesMixtesActifs: boolean,
): EvaluationPlan {
  return {
    violationsSeparation: contraintesNonRespectees(contraintes, places).length,

    violationsGroupement: groupesProximiteNonRespectes(
      groupesProximite,
      places,
    ).length,

    violationsDevant: elevesDevantNonRespectes(elevesDevant, places).length,

    mixtes: binomesMixtesActifs ? calculerScoreBinomes(eleves, places).mixtes : 0,
  };
}

function genererMeilleurPlan(
  eleves: Eleve[],
  places: Place[],
  contraintes: ContrainteSeparation[],
  groupesProximite: GroupeProximite[],
  elevesDevant: number[],
  binomesMixtesActifs: boolean,
): Place[] {
  let meilleurPlan = genererPlanMixte(eleves, places, binomesMixtesActifs);

  let meilleureEvaluation = evaluerPlan(
    eleves,
    meilleurPlan,
    contraintes,
    groupesProximite,
    elevesDevant,
    binomesMixtesActifs,
  );

  for (let essai = 1; essai < 1400; essai++) {
    const candidat = genererPlanMixte(eleves, places, binomesMixtesActifs);

    const evaluation = evaluerPlan(
      eleves,
      candidat,
      contraintes,
      groupesProximite,
      elevesDevant,
      binomesMixtesActifs,
    );

    const meilleureSeparation =
      evaluation.violationsSeparation <
      meilleureEvaluation.violationsSeparation;

    const meilleurGroupement =
      evaluation.violationsSeparation ===
        meilleureEvaluation.violationsSeparation &&
      evaluation.violationsGroupement <
        meilleureEvaluation.violationsGroupement;

    const meilleurDevant =
      evaluation.violationsSeparation ===
        meilleureEvaluation.violationsSeparation &&
      evaluation.violationsGroupement ===
        meilleureEvaluation.violationsGroupement &&
      evaluation.violationsDevant < meilleureEvaluation.violationsDevant;

    const plusMixte =
      evaluation.violationsSeparation ===
        meilleureEvaluation.violationsSeparation &&
      evaluation.violationsGroupement ===
        meilleureEvaluation.violationsGroupement &&
      evaluation.violationsDevant === meilleureEvaluation.violationsDevant &&
      evaluation.mixtes > meilleureEvaluation.mixtes;

    if (
      meilleureSeparation ||
      meilleurGroupement ||
      meilleurDevant ||
      plusMixte
    ) {
      meilleurPlan = candidat;
      meilleureEvaluation = evaluation;
    }

    if (
      meilleureEvaluation.violationsSeparation === 0 &&
      meilleureEvaluation.violationsGroupement === 0 &&
      meilleureEvaluation.violationsDevant === 0 &&
      (!binomesMixtesActifs ||
        meilleureEvaluation.mixtes >= calculerScoreBinomes(eleves, meilleurPlan).possibles)
    ) {
      break;
    }
  }

  return meilleurPlan;
}

export default function Home() {
  const [vue, setVue] = useState<Vue>("classes");

  const [projets, setProjets] = useState<Projet[]>([]);

  const [projetActifId, setProjetActifId] = useState<string | null>(null);

  const [nomProjet, setNomProjet] = useState("");

  const [nomNouvelleClasse, setNomNouvelleClasse] = useState("");

  const [statutSauvegarde, setStatutSauvegarde] =
    useState<StatutSauvegarde>("enregistre");

  const [eleves, setEleves] = useState<Eleve[]>([]);

  const [places, setPlaces] = useState<Place[]>(creerDispositionClassique());

  const [modeSalle, setModeSalle] = useState<ModeSalle>("classique");

  const [contraintes, setContraintes] = useState<ContrainteSeparation[]>([]);

  const [groupesProximite, setGroupesProximite] = useState<GroupeProximite[]>([]);

  const [elevesDevant, setElevesDevant] = useState<number[]>([]);

  const [associations, setAssociations] = useState<Record<number, string>>({});

  const [associationsProximite, setAssociationsProximite] = useState<
    Record<number, string>
  >({});

  const [eleveAPlacerDevant, setEleveAPlacerDevant] = useState<number | null>(
    null,
  );

  const [eleveDeplace, setEleveDeplace] = useState<number | null>(null);

  const [tableDeplaceeId, setTableDeplaceeId] = useState<number | null>(null);

  const [reperesAlignement, setReperesAlignement] = useState<{
    x: number | null;
    y: number | null;
  }>({
    x: null,
    y: null,
  });

  const [tablesSelectionnees, setTablesSelectionnees] = useState<number[]>([]);

  const [rectangleSelection, setRectangleSelection] =
    useState<RectangleSelection | null>(null);

  const [historiqueSalle, setHistoriqueSalle] = useState<EtatSalleHistorique[]>(
    [],
  );

  const salleRef = useRef<HTMLDivElement | null>(null);

  const [modeSelectionSeparation, setModeSelectionSeparation] = useState(false);

  const [selectionSeparation, setSelectionSeparation] = useState<number[]>([]);

  const [modeSelectionGroupement, setModeSelectionGroupement] = useState(false);

  const [selectionGroupement, setSelectionGroupement] = useState<number[]>([]);

  const [vueExport, setVueExport] = useState<VueExport>("aerienne");

  const [grilleSuiviActive, setGrilleSuiviActive] = useState(false);

  const [nombreCasesSuivi, setNombreCasesSuivi] = useState(8);

  const [binomesMixtesActifs, setBinomesMixtesActifs] = useState(true);

  useEffect(function () {
    try {
      let texte = localStorage.getItem(CLE_PROJETS);

      if (!texte) {
        texte = localStorage.getItem("plan-de-classe-projets-v1");
      }

      if (!texte) {
        return;
      }

      const sauvegardes = JSON.parse(texte);

      if (!Array.isArray(sauvegardes)) {
        return;
      }

      const normalises: Projet[] = sauvegardes.map(function (projet: any) {
        return {
          id: String(projet.id ?? creerIdentifiant()),

          nom: projet.nom ?? "Classe",

          eleves: Array.isArray(projet.eleves) ? projet.eleves : [],

          places: Array.isArray(projet.places)
            ? projet.places.map(function (place: any) {
                return {
                  id: Number(place.id),

                  x: Number(place.x),

                  y: Number(place.y),

                  eleveId: place.eleveId ?? null,

                  verrouillee: place.verrouillee ?? false,
                };
              })
            : creerDispositionClassique(),

          contraintes: Array.isArray(projet.contraintes)
            ? projet.contraintes
            : [],

          groupesProximite: Array.isArray(projet.groupesProximite)
            ? projet.groupesProximite
                .map(function (groupe: any) {
                  return {
                    id: Number(groupe.id ?? Date.now() + Math.random()),
                    eleveIds: Array.isArray(groupe.eleveIds)
                      ? groupe.eleveIds.map(Number).slice(0, 3)
                      : [],
                  };
                })
                .filter(function (groupe: GroupeProximite) {
                  return groupe.eleveIds.length >= 2;
                })
            : [],

          elevesDevant: Array.isArray(projet.elevesDevant)
            ? projet.elevesDevant
            : [],

          modeSalle: projet.modeSalle ?? "classique",

          grilleSuiviActive: projet.grilleSuiviActive ?? false,

          nombreCasesSuivi: [4, 6, 8, 10].includes(Number(projet.nombreCasesSuivi))
            ? Number(projet.nombreCasesSuivi)
            : 8,

          binomesMixtesActifs: projet.binomesMixtesActifs ?? true,

          dateModification: projet.dateModification ?? new Date().toISOString(),
        };
      });

      setProjets(normalises);

      localStorage.setItem(CLE_PROJETS, JSON.stringify(normalises));
    } catch {
      console.error("Impossible de charger les classes.");
    }
  }, []);

  useEffect(
    function () {
      if (!projetActifId) {
        return;
      }

      setStatutSauvegarde("enregistrement");

      const minuterie = window.setTimeout(function () {
        setProjets(function (actuels) {
          const projetMisAJour: Projet = {
            id: projetActifId,
            nom: nomProjet,
            eleves,
            places,
            contraintes,
            groupesProximite,
            elevesDevant,
            modeSalle,
            grilleSuiviActive,
            nombreCasesSuivi,
            binomesMixtesActifs,

            dateModification: new Date().toISOString(),
          };

          const nouvelleListe = actuels.map(function (projet) {
            return projet.id === projetActifId ? projetMisAJour : projet;
          });

          localStorage.setItem(CLE_PROJETS, JSON.stringify(nouvelleListe));

          return nouvelleListe;
        });

        setStatutSauvegarde("enregistre");
      }, 600);

      return function () {
        window.clearTimeout(minuterie);
      };
    },
    [
      projetActifId,
      nomProjet,
      eleves,
      places,
      contraintes,
      groupesProximite,
      elevesDevant,
      modeSalle,
      grilleSuiviActive,
      nombreCasesSuivi,
      binomesMixtesActifs,
    ],
  );

  useEffect(
    function () {
      if (vue !== "salle") {
        return;
      }

      function gererClavier(event: KeyboardEvent) {
        const cible = event.target;

        if (
          cible instanceof HTMLInputElement ||
          cible instanceof HTMLSelectElement ||
          cible instanceof HTMLTextAreaElement
        ) {
          return;
        }

        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "z"
        ) {
          event.preventDefault();

          if (event.repeat) {
            return;
          }

          annulerDerniereModificationSalle();

          return;
        }

        if (event.key === "Escape") {
          setTablesSelectionnees([]);
          setRectangleSelection(null);

          return;
        }

        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          tablesSelectionnees.length > 0
        ) {
          event.preventDefault();

          supprimerTablesSelectionnees();
        }
      }

      window.addEventListener("keydown", gererClavier);

      return function () {
        window.removeEventListener("keydown", gererClavier);
      };
    },
    [vue, tablesSelectionnees, places, modeSalle],
  );

  const scoreBinomes = calculerScoreBinomes(eleves, places);

  const contraintesEnErreur = contraintesNonRespectees(contraintes, places);

  const groupesEnErreur = groupesProximiteNonRespectes(
    groupesProximite,
    places,
  );

  const devantEnErreur = elevesDevantNonRespectes(elevesDevant, places);

  const nombreVerrouilles = places.filter(function (place) {
    return place.verrouillee && place.eleveId !== null;
  }).length;

  const idsElevesPlaces = new Set(
    places
      .map(function (place) {
        return place.eleveId;
      })
      .filter(function (id): id is number {
        return id !== null;
      }),
  );

  const elevesNonPlaces = eleves.filter(function (eleve) {
    return !idsElevesPlaces.has(eleve.id);
  });

  const rangeesSalle = Array.from(
    new Set(
      places.map(function (place) {
        return place.y;
      }),
    ),
  ).sort(function (a, b) {
    return a - b;
  });

  const nombreRangeesSalle = rangeesSalle.length;

  const hauteurSallePixels = Math.max(
    420,
    140 + Math.max(1, nombreRangeesSalle) * 75,
  );

  // À l'écran, la grille de suivi rend les cartes un peu plus hautes.
  // On augmente seulement la hauteur du Plan général pour éviter tout
  // chevauchement. L'export possède déjà sa propre mise en page compacte.
  const hauteurPlanPixels = grilleSuiviActive
    ? hauteurSallePixels + 90
    : hauteurSallePixels;

  // Dans le Plan général, on réduit automatiquement les marges latérales
  // laissées dans l'éditeur de salle. La géométrie relative de la salle
  // est conservée, mais l'ensemble est étiré pour occuper la largeur
  // du tableau (de 8 % à 92 %). L'éditeur de salle, lui, ne change pas.
  const positionsXPlan = places.map(function (place) {
    return place.x;
  });

  const minimumXPlan =
    positionsXPlan.length > 0 ? Math.min(...positionsXPlan) : 8;

  const maximumXPlan =
    positionsXPlan.length > 0 ? Math.max(...positionsXPlan) : 92;

  function positionXPourPlan(x: number): number {
    const largeurUtilisee = maximumXPlan - minimumXPlan;

    if (largeurUtilisee < 0.5) {
      return 50;
    }

    return 8 + ((x - minimumXPlan) / largeurUtilisee) * 84;
  }

  // Pour l'export uniquement, on compacte les grands espaces horizontaux
  // (les couloirs) afin de laisser davantage de place aux cartes élèves.
  // Le mode classique est compacté plus fortement car ses grands écarts
  // correspondent presque toujours à des couloirs. En mode libre, la
  // compression reste plus douce afin de respecter le bricolage de la salle.
  const positionsXUniquesExport = Array.from(
    new Set(
      places.map(function (place) {
        return Number(place.x.toFixed(2));
      }),
    ),
  ).sort(function (a, b) {
    return a - b;
  });

  const ecartsXExport = positionsXUniquesExport
    .slice(1)
    .map(function (x, index) {
      return x - positionsXUniquesExport[index];
    })
    .filter(function (ecart) {
      return ecart > 0.5;
    })
    .sort(function (a, b) {
      return a - b;
    });

  const ecartBaseExport =
    ecartsXExport.length > 0
      ? ecartsXExport[Math.floor((ecartsXExport.length - 1) / 2)]
      : 8;

  const ecartMaxExport =
    ecartBaseExport * (modeSalle === "classique" ? 1.15 : 1.55);

  const positionCompacteeParX = new Map<number, number>();

  if (positionsXUniquesExport.length === 1) {
    positionCompacteeParX.set(positionsXUniquesExport[0], 50);
  } else if (positionsXUniquesExport.length > 1) {
    const positionsCumulees: number[] = [0];

    for (let index = 1; index < positionsXUniquesExport.length; index++) {
      const ecartOriginal =
        positionsXUniquesExport[index] - positionsXUniquesExport[index - 1];

      positionsCumulees.push(
        positionsCumulees[index - 1] + Math.min(ecartOriginal, ecartMaxExport),
      );
    }

    const largeurCompactee =
      positionsCumulees[positionsCumulees.length - 1] || 1;

    positionsXUniquesExport.forEach(function (x, index) {
      // On garde un peu moins de marge qu'à l'écran pour profiter au maximum
      // de la largeur de la page imprimée.
      const position = 6 + (positionsCumulees[index] / largeurCompactee) * 88;
      positionCompacteeParX.set(x, position);
    });
  }

  function positionXPourExport(x: number): number {
    if (positionsXUniquesExport.length === 0) {
      return positionXPourPlan(x);
    }

    const xArrondi = Number(x.toFixed(2));
    const positionExacte = positionCompacteeParX.get(xArrondi);

    if (positionExacte !== undefined) {
      return positionExacte;
    }

    // Cas de secours pour une table dont la coordonnée n'aurait pas été
    // retrouvée exactement après un déplacement en mode libre.
    let xLePlusProche = positionsXUniquesExport[0];
    let meilleureDistance = Math.abs(xArrondi - xLePlusProche);

    positionsXUniquesExport.forEach(function (candidat) {
      const distance = Math.abs(xArrondi - candidat);

      if (distance < meilleureDistance) {
        xLePlusProche = candidat;
        meilleureDistance = distance;
      }
    });

    return positionCompacteeParX.get(xLePlusProche) ?? positionXPourPlan(x);
  }

  function obtenirEleve(id: number | null): Eleve | null {
    if (id === null) {
      return null;
    }

    return (
      eleves.find(function (eleve) {
        return eleve.id === id;
      }) ?? null
    );
  }

  function memoriserEtatSalle() {
    setHistoriqueSalle(function (historique) {
      return [
        ...historique.slice(-29),

        {
          places: places.map(function (place) {
            return {
              ...place,
            };
          }),

          modeSalle,
        },
      ];
    });
  }

  function annulerDerniereModificationSalle() {
    setHistoriqueSalle(function (historique) {
      if (historique.length === 0) {
        return historique;
      }

      const precedent = historique[historique.length - 1];

      setPlaces(
        precedent.places.map(function (place) {
          return {
            ...place,
          };
        }),
      );

      setModeSalle(precedent.modeSalle);

      setTablesSelectionnees([]);
      setRectangleSelection(null);

      return historique.slice(0, -1);
    });
  }

  function ouvrirProjet(projet: Projet) {
    setProjetActifId(projet.id);

    setNomProjet(projet.nom);

    setEleves(
      projet.eleves.map(function (eleve) {
        return {
          ...eleve,
        };
      }),
    );

    setPlaces(
      projet.places.map(function (place) {
        return {
          ...place,

          verrouillee: place.verrouillee ?? false,
        };
      }),
    );

    setContraintes(
      projet.contraintes.map(function (contrainte) {
        return {
          ...contrainte,
        };
      }),
    );

    setGroupesProximite(
      (projet.groupesProximite ?? []).map(function (groupe) {
        return { ...groupe, eleveIds: [...groupe.eleveIds] };
      }),
    );

    setElevesDevant([...projet.elevesDevant]);

    setModeSalle(projet.modeSalle ?? "classique");

    setGrilleSuiviActive(projet.grilleSuiviActive ?? false);
    setNombreCasesSuivi(
      [4, 6, 8, 10].includes(Number(projet.nombreCasesSuivi))
        ? Number(projet.nombreCasesSuivi)
        : 8,
    );
    setBinomesMixtesActifs(projet.binomesMixtesActifs ?? true);

    setHistoriqueSalle([]);
    setTablesSelectionnees([]);

    setVue("plan");

    setStatutSauvegarde("enregistre");
  }

  function creerNouvelleClasse() {
    const nom = nomNouvelleClasse.trim();

    if (!nom) {
      return;
    }

    const id = creerIdentifiant();

    const nouvellesPlaces = creerDispositionClassique();

    const nouveauProjet: Projet = {
      id,
      nom,
      eleves: [],
      places: nouvellesPlaces,
      contraintes: [],
      groupesProximite: [],
      elevesDevant: [],
      modeSalle: "classique",
      grilleSuiviActive: false,
      nombreCasesSuivi: 8,
      binomesMixtesActifs: true,

      dateModification: new Date().toISOString(),
    };

    const nouvelleListe = [...projets, nouveauProjet];

    setProjets(nouvelleListe);

    localStorage.setItem(CLE_PROJETS, JSON.stringify(nouvelleListe));

    setProjetActifId(id);
    setNomProjet(nom);
    setEleves([]);
    setPlaces(nouvellesPlaces);
    setContraintes([]);
    setGroupesProximite([]);
    setElevesDevant([]);
    setModeSalle("classique");
    setGrilleSuiviActive(false);
    setNombreCasesSuivi(8);
    setBinomesMixtesActifs(true);
    setNomNouvelleClasse("");

    setVue("plan");
  }

  function nomFichierClasse(nom: string): string {
    const nettoye = nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    return nettoye || "classe";
  }

  function exporterProjet(projet: Projet) {
    const contenu = {
      format: "planclasse",
      version: 1,
      exporteLe: new Date().toISOString(),
      projet,
    };

    const blob = new Blob([JSON.stringify(contenu, null, 2)], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");

    lien.href = url;
    lien.download = nomFichierClasse(projet.nom) + ".planclasse";
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
  }

  function normaliserProjetImporte(source: any): Projet | null {
    if (!source || typeof source !== "object") {
      return null;
    }

    if (!Array.isArray(source.eleves) || !Array.isArray(source.places)) {
      return null;
    }

    const elevesImportes: Eleve[] = source.eleves
      .map(function (eleve: any) {
        return {
          id: Number(eleve.id),
          prenom: String(eleve.prenom ?? ""),
          nom: String(eleve.nom ?? ""),
          sexe: String(eleve.sexe ?? ""),
        };
      })
      .filter(function (eleve: Eleve) {
        return Number.isFinite(eleve.id);
      });

    const idsEleves = new Set(
      elevesImportes.map(function (eleve) {
        return eleve.id;
      }),
    );

    const placesImportees: Place[] = source.places
      .map(function (place: any) {
        const eleveIdBrut = place.eleveId;
        const eleveId =
          eleveIdBrut === null || eleveIdBrut === undefined
            ? null
            : Number(eleveIdBrut);

        return {
          id: Number(place.id),
          x: Number(place.x),
          y: Number(place.y),
          eleveId:
            eleveId !== null && Number.isFinite(eleveId) && idsEleves.has(eleveId)
              ? eleveId
              : null,
          verrouillee: Boolean(place.verrouillee),
        };
      })
      .filter(function (place: Place) {
        return (
          Number.isFinite(place.id) &&
          Number.isFinite(place.x) &&
          Number.isFinite(place.y)
        );
      });

    if (placesImportees.length === 0) {
      return null;
    }

    const contraintesImportees: ContrainteSeparation[] = Array.isArray(
      source.contraintes,
    )
      ? source.contraintes
          .map(function (contrainte: any) {
            return {
              id: Number(contrainte.id ?? Date.now() + Math.random()),
              eleve1Id: Number(contrainte.eleve1Id),
              eleve2Id: Number(contrainte.eleve2Id),
            };
          })
          .filter(function (contrainte: ContrainteSeparation) {
            return (
              idsEleves.has(contrainte.eleve1Id) &&
              idsEleves.has(contrainte.eleve2Id) &&
              contrainte.eleve1Id !== contrainte.eleve2Id
            );
          })
      : [];

    const groupesImportes: GroupeProximite[] = Array.isArray(
      source.groupesProximite,
    )
      ? source.groupesProximite
          .map(function (groupe: any) {
            const eleveIds = Array.isArray(groupe.eleveIds)
              ? groupe.eleveIds
                  .map(Number)
                  .filter(function (id: number) {
                    return idsEleves.has(id);
                  })
                  .slice(0, 3)
              : [];

            return {
              id: Number(groupe.id ?? Date.now() + Math.random()),
              eleveIds,
            };
          })
          .filter(function (groupe: GroupeProximite) {
            return groupe.eleveIds.length >= 2;
          })
      : [];

    const devantImportes = Array.isArray(source.elevesDevant)
      ? source.elevesDevant
          .map(Number)
          .filter(function (id: number) {
            return idsEleves.has(id);
          })
      : [];

    const modeImporte: ModeSalle =
      source.modeSalle === "libre" ? "libre" : "classique";

    return {
      id: creerIdentifiant(),
      nom:
        typeof source.nom === "string" && source.nom.trim()
          ? source.nom.trim()
          : "Classe importée",
      eleves: elevesImportes,
      places: placesImportees,
      contraintes: contraintesImportees,
      groupesProximite: groupesImportes,
      elevesDevant: devantImportes,
      modeSalle: modeImporte,
      grilleSuiviActive: Boolean(source.grilleSuiviActive),
      nombreCasesSuivi: [4, 6, 8, 10].includes(Number(source.nombreCasesSuivi))
        ? Number(source.nombreCasesSuivi)
        : 8,
      binomesMixtesActifs: source.binomesMixtesActifs ?? true,
      dateModification: new Date().toISOString(),
    };
  }

  function importerProjet(event: React.ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];

    if (!fichier) {
      return;
    }

    const lecteur = new FileReader();

    lecteur.onload = function () {
      try {
        const contenu = JSON.parse(String(lecteur.result ?? ""));
        const source =
          contenu?.format === "planclasse" && contenu?.projet
            ? contenu.projet
            : contenu;

        const projetImporte = normaliserProjetImporte(source);

        if (!projetImporte) {
          window.alert(
            "Ce fichier ne semble pas être une sauvegarde Plan de Classe valide.",
          );
          return;
        }

        const nouvelleListe = [...projets, projetImporte];
        setProjets(nouvelleListe);
        localStorage.setItem(CLE_PROJETS, JSON.stringify(nouvelleListe));

        ouvrirProjet(projetImporte);
      } catch {
        window.alert(
          "Impossible de lire ce fichier. Vérifie qu'il s'agit bien d'un fichier .planclasse exporté depuis l'application.",
        );
      } finally {
        event.target.value = "";
      }
    };

    lecteur.onerror = function () {
      window.alert("Impossible de lire ce fichier.");
      event.target.value = "";
    };

    lecteur.readAsText(fichier);
  }

  function supprimerProjet(projetId: string) {
    const projet = projets.find(function (item) {
      return item.id === projetId;
    });

    const confirmation = window.confirm(
      `Supprimer définitivement la classe « ${projet?.nom ?? "Classe"} » ?\n\n` +
        "Les élèves, le plan de salle et toutes les règles associées seront supprimés de ce navigateur.",
    );

    if (!confirmation) {
      return;
    }

    const nouvelleListe = projets.filter(function (projet) {
      return projet.id !== projetId;
    });

    setProjets(nouvelleListe);

    localStorage.setItem(CLE_PROJETS, JSON.stringify(nouvelleListe));

    if (projetActifId === projetId) {
      setProjetActifId(null);
    }
  }

  function ajouterContrainteEntre(eleve1Id: number, eleve2Id: number) {
    if (eleve1Id === eleve2Id) {
      return;
    }

    const existe = contraintes.some(function (contrainte) {
      return (
        (contrainte.eleve1Id === eleve1Id &&
          contrainte.eleve2Id === eleve2Id) ||
        (contrainte.eleve1Id === eleve2Id && contrainte.eleve2Id === eleve1Id)
      );
    });

    if (existe) {
      return;
    }

    setContraintes(function (actuelles) {
      return [
        ...actuelles,

        {
          id: Date.now() + Math.random(),

          eleve1Id,
          eleve2Id,
        },
      ];
    });
  }

  function supprimerContrainte(id: number) {
    setContraintes(function (actuelles) {
      return actuelles.filter(function (contrainte) {
        return contrainte.id !== id;
      });
    });
  }

  function partenairesDe(eleveId: number): Eleve[] {
    const ids = contraintes
      .filter(function (contrainte) {
        return (
          contrainte.eleve1Id === eleveId || contrainte.eleve2Id === eleveId
        );
      })
      .map(function (contrainte) {
        return contrainte.eleve1Id === eleveId
          ? contrainte.eleve2Id
          : contrainte.eleve1Id;
      });

    return eleves.filter(function (eleve) {
      return ids.includes(eleve.id);
    });
  }

  function trouverContrainte(eleve1Id: number, eleve2Id: number) {
    return contraintes.find(function (contrainte) {
      return (
        (contrainte.eleve1Id === eleve1Id &&
          contrainte.eleve2Id === eleve2Id) ||
        (contrainte.eleve1Id === eleve2Id && contrainte.eleve2Id === eleve1Id)
      );
    });
  }

  function groupesDe(eleveId: number): GroupeProximite[] {
    return groupesProximite.filter(function (groupe) {
      return groupe.eleveIds.includes(eleveId);
    });
  }

  function partenairesProximiteDe(eleveId: number): Eleve[] {
    const ids = new Set<number>();

    groupesDe(eleveId).forEach(function (groupe) {
      groupe.eleveIds.forEach(function (id) {
        if (id !== eleveId) {
          ids.add(id);
        }
      });
    });

    return eleves.filter(function (eleve) {
      return ids.has(eleve.id);
    });
  }

  function ajouterGroupeProximite(ids: number[]) {
    const uniques = Array.from(new Set(ids)).slice(0, 3);

    if (uniques.length < 2) {
      return;
    }

    const existe = groupesProximite.some(function (groupe) {
      return (
        groupe.eleveIds.length === uniques.length &&
        uniques.every(function (id) {
          return groupe.eleveIds.includes(id);
        })
      );
    });

    if (existe) {
      return;
    }

    setGroupesProximite(function (actuels) {
      return [
        ...actuels,
        {
          id: Date.now() + Math.random(),
          eleveIds: uniques,
        },
      ];
    });
  }

  function supprimerGroupeProximite(id: number) {
    setGroupesProximite(function (actuels) {
      return actuels.filter(function (groupe) {
        return groupe.id !== id;
      });
    });
  }

  function retirerRelationProximite(eleveId: number, partenaireId: number) {
    setGroupesProximite(function (actuels) {
      return actuels
        .map(function (groupe) {
          if (
            !groupe.eleveIds.includes(eleveId) ||
            !groupe.eleveIds.includes(partenaireId)
          ) {
            return groupe;
          }

          if (groupe.eleveIds.length <= 2) {
            return null;
          }

          return {
            ...groupe,
            eleveIds: groupe.eleveIds.filter(function (id) {
              return id !== partenaireId;
            }),
          };
        })
        .filter(function (groupe): groupe is GroupeProximite {
          return groupe !== null && groupe.eleveIds.length >= 2;
        });
    });
  }

  function choisirProximiteDepuisTable(eleveId: number, valeur: string) {
    if (!valeur) {
      return;
    }

    const partenaireId = Number(valeur);

    const groupeExtensible = groupesProximite.find(function (groupe) {
      return groupe.eleveIds.includes(eleveId) && groupe.eleveIds.length < 3;
    });

    if (groupeExtensible && !groupeExtensible.eleveIds.includes(partenaireId)) {
      setGroupesProximite(function (actuels) {
        return actuels.map(function (groupe) {
          if (groupe.id !== groupeExtensible.id) {
            return groupe;
          }

          return {
            ...groupe,
            eleveIds: [...groupe.eleveIds, partenaireId].slice(0, 3),
          };
        });
      });
    } else {
      ajouterGroupeProximite([eleveId, partenaireId]);
    }

    setAssociationsProximite(function (actuelles) {
      return { ...actuelles, [eleveId]: "" };
    });
  }

  function modifierEleve(
    id: number,
    champ: "prenom" | "nom" | "sexe",
    valeur: string,
  ) {
    setEleves(function (actuels) {
      return actuels.map(function (eleve) {
        if (eleve.id !== id) {
          return eleve;
        }

        return {
          ...eleve,
          [champ]: valeur,
        };
      });
    });
  }

  function basculerEleveDevant(eleveId: number) {
    setElevesDevant(function (actuels) {
      if (actuels.includes(eleveId)) {
        return actuels.filter(function (id) {
          return id !== eleveId;
        });
      }

      return [...actuels, eleveId];
    });
  }

  function ajouterEleve() {
    const prochainId =
      eleves.reduce(function (maximum, eleve) {
        return Math.max(maximum, eleve.id);
      }, 0) + 1;

    setEleves(function (actuels) {
      return [
        ...actuels,

        {
          id: prochainId,

          prenom: "Nouvel",

          nom: "Élève",

          sexe: "",
        },
      ];
    });
  }

  function supprimerEleve(eleveId: number) {
    setEleves(function (actuels) {
      return actuels.filter(function (eleve) {
        return eleve.id !== eleveId;
      });
    });

    setPlaces(function (actuelles) {
      return actuelles.map(function (place) {
        if (place.eleveId !== eleveId) {
          return place;
        }

        return {
          ...place,
          eleveId: null,
          verrouillee: false,
        };
      });
    });

    setContraintes(function (actuelles) {
      return actuelles.filter(function (contrainte) {
        return (
          contrainte.eleve1Id !== eleveId && contrainte.eleve2Id !== eleveId
        );
      });
    });

    setElevesDevant(function (actuels) {
      return actuels.filter(function (id) {
        return id !== eleveId;
      });
    });

    setGroupesProximite(function (actuels) {
      return actuels
        .map(function (groupe) {
          return {
            ...groupe,
            eleveIds: groupe.eleveIds.filter(function (id) {
              return id !== eleveId;
            }),
          };
        })
        .filter(function (groupe) {
          return groupe.eleveIds.length >= 2;
        });
    });
  }

  function demanderSuppressionEleve(eleve: Eleve) {
    const confirmation = window.confirm(
      `Supprimer ${eleve.prenom} ${eleve.nom} de cette classe ?\n\n` +
        "Cela supprimera aussi sa place actuelle, son éventuelle règle « placer devant », ses groupements et toutes ses contraintes de séparation.\n\n" +
        "Cette modification sera enregistrée automatiquement.",
    );

    if (!confirmation) {
      return;
    }

    supprimerEleve(eleve.id);
  }

  function demanderSuppressionTousLesEleves() {
    if (eleves.length === 0) {
      return;
    }

    const confirmation = window.confirm(
      `Supprimer les ${eleves.length} élèves de cette classe ?\n\n` +
        "Cela videra aussi toutes les places et supprimera les règles de placement, " +
        "les séparations et les binômes / trinômes.\n\n" +
        "Cette action sera enregistrée automatiquement.",
    );

    if (!confirmation) {
      return;
    }

    setEleves([]);

    setPlaces(function (actuelles) {
      return actuelles.map(function (place) {
        return {
          ...place,
          eleveId: null,
          verrouillee: false,
        };
      });
    });

    setContraintes([]);
    setGroupesProximite([]);
    setElevesDevant([]);
    setAssociations({});
    setAssociationsProximite({});
    setEleveAPlacerDevant(null);
    setSelectionSeparation([]);
    setSelectionGroupement([]);
    setModeSelectionSeparation(false);
    setModeSelectionGroupement(false);
  }

  function choisirSeparationDepuisTable(eleveId: number, valeur: string) {
    if (!valeur) {
      return;
    }

    ajouterContrainteEntre(eleveId, Number(valeur));

    setAssociations(function (actuelles) {
      return {
        ...actuelles,

        [eleveId]: "",
      };
    });
  }

  function commencerModeSeparation() {
    setModeSelectionGroupement(false);
    setSelectionGroupement([]);
    setModeSelectionSeparation(true);
    setSelectionSeparation([]);
  }

  function annulerModeSeparation() {
    setModeSelectionSeparation(false);
    setSelectionSeparation([]);
  }

  function basculerSelectionSeparation(eleveId: number) {
    setSelectionSeparation(function (actuelle) {
      if (actuelle.includes(eleveId)) {
        return actuelle.filter(function (id) {
          return id !== eleveId;
        });
      }

      if (actuelle.length >= 2) {
        return [eleveId];
      }

      return [...actuelle, eleveId];
    });
  }

  function creerSeparationSelectionnee() {
    if (selectionSeparation.length !== 2) {
      return;
    }

    ajouterContrainteEntre(selectionSeparation[0], selectionSeparation[1]);

    annulerModeSeparation();
  }

  function commencerModeGroupement() {
    setModeSelectionSeparation(false);
    setSelectionSeparation([]);
    setModeSelectionGroupement(true);
    setSelectionGroupement([]);
  }

  function annulerModeGroupement() {
    setModeSelectionGroupement(false);
    setSelectionGroupement([]);
  }

  function basculerSelectionGroupement(eleveId: number) {
    setSelectionGroupement(function (actuelle) {
      if (actuelle.includes(eleveId)) {
        return actuelle.filter(function (id) {
          return id !== eleveId;
        });
      }

      if (actuelle.length >= 3) {
        return [eleveId];
      }

      return [...actuelle, eleveId];
    });
  }

  function creerGroupementSelectionne() {
    if (selectionGroupement.length < 2 || selectionGroupement.length > 3) {
      return;
    }

    ajouterGroupeProximite(selectionGroupement);
    annulerModeGroupement();
  }

  function commencerGlisser(place: Place) {
    if (
      modeSelectionSeparation ||
      modeSelectionGroupement ||
      place.verrouillee ||
      place.eleveId === null
    ) {
      return;
    }

    setEleveDeplace(place.eleveId);
  }

  function deposerSurPlace(placeId: number) {
    if (
      eleveDeplace === null ||
      modeSelectionSeparation ||
      modeSelectionGroupement
    ) {
      return;
    }

    setPlaces(function (actuelles) {
      const copie = actuelles.map(function (place) {
        return {
          ...place,
        };
      });

      const depart = copie.find(function (place) {
        return place.eleveId === eleveDeplace;
      });

      const destination = copie.find(function (place) {
        return place.id === placeId;
      });

      if (
        !depart ||
        !destination ||
        depart.verrouillee ||
        destination.verrouillee
      ) {
        return copie;
      }

      const ancien = destination.eleveId;

      destination.eleveId = eleveDeplace;

      depart.eleveId = ancien;

      return copie;
    });

    setEleveDeplace(null);
  }

  function basculerVerrouillage(placeId: number) {
    setPlaces(function (actuelles) {
      return actuelles.map(function (place) {
        if (place.id !== placeId || place.eleveId === null) {
          return place;
        }

        return {
          ...place,

          verrouillee: !place.verrouillee,
        };
      });
    });
  }

  function toutDeverrouiller() {
    setPlaces(function (actuelles) {
      return actuelles.map(function (place) {
        return {
          ...place,
          verrouillee: false,
        };
      });
    });
  }

  function ordreAlphabetiquePrenom() {
    const elevesVerrouilles = obtenirElevesVerrouilles(places);

    const elevesDisponibles = eleves
      .filter(function (eleve) {
        return !elevesVerrouilles.has(eleve.id);
      })
      .sort(function (a, b) {
        const comparaisonPrenom = a.prenom.localeCompare(b.prenom, "fr", {
          sensitivity: "base",
        });

        if (comparaisonPrenom !== 0) {
          return comparaisonPrenom;
        }

        return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
      });

    const placesDisponibles = places
      .filter(function (place) {
        return !place.verrouillee;
      })
      .sort(function (a, b) {
        if (Math.abs(a.y - b.y) > 0.5) {
          return a.y - b.y;
        }

        return a.x - b.x;
      });

    const affectations = new Map<number, number | null>();

    placesDisponibles.forEach(function (place) {
      affectations.set(place.id, null);
    });

    elevesDisponibles.forEach(function (eleve, index) {
      const place = placesDisponibles[index];

      if (place) {
        affectations.set(place.id, eleve.id);
      }
    });

    setPlaces(function (actuelles) {
      return actuelles.map(function (place) {
        if (place.verrouillee) {
          return place;
        }

        return {
          ...place,
          eleveId: affectations.get(place.id) ?? null,
        };
      });
    });
  }

  function melangerIntelligemment() {
    setPlaces(
      genererMeilleurPlan(
        eleves,
        places,
        contraintes,
        groupesProximite,
        elevesDevant,
        binomesMixtesActifs,
      ),
    );
  }

  function ajouterEleveDevant() {
    if (eleveAPlacerDevant === null) {
      return;
    }

    if (!elevesDevant.includes(eleveAPlacerDevant)) {
      setElevesDevant(function (actuels) {
        return [...actuels, eleveAPlacerDevant];
      });
    }

    setEleveAPlacerDevant(null);
  }

  function importerCSV(event: React.ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];

    if (!fichier) {
      return;
    }

    Papa.parse(fichier, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: function (entete) {
        return entete.replace(/^\uFEFF/, "").trim();
      },

      complete: function (result) {
        const nouveauxEleves: Eleve[] = result.data
          .map(function (ligne: any, index: number) {
            const prenomSepare = String(
              ligne.Prénom ?? ligne.Prenom ?? ligne.prenom ?? "",
            ).trim();
            const nomSepare = String(ligne.Nom ?? ligne.nom ?? "").trim();

            // Certains logiciels enseignants exportent « NOM Prénom » dans
            // une seule colonne « Élèves ». Les noms de famille étant en
            // majuscules, on peut repérer automatiquement où commence le prénom.
            const nomComplet =
              ligne["Élèves"] ??
              ligne.Eleves ??
              ligne["Élève"] ??
              ligne.Eleve ??
              ligne["Nom Prénom"] ??
              ligne["Nom Prenom"] ??
              "";

            const nomsDetectes =
              prenomSepare || nomSepare
                ? { nom: nomSepare, prenom: prenomSepare }
                : separerNomPrenomEnseignant(nomComplet);

            return {
              id: Date.now() + index,
              prenom: nomsDetectes.prenom,
              nom: nomsDetectes.nom,
              sexe: normaliserSexeImport(ligne.Sexe ?? ligne.sexe ?? ""),
            };
          })
          .filter(function (eleve: Eleve) {
            return Boolean(eleve.prenom || eleve.nom);
          });

        if (nouveauxEleves.length === 0) {
          window.alert(
            "Aucun élève n’a été trouvé dans ce fichier. Vérifie qu’il s’agit bien d’un CSV contenant soit les colonnes Prénom/Nom, soit une colonne Élèves.",
          );
          return;
        }

        setEleves(nouveauxEleves);
        setContraintes([]);
        setGroupesProximite([]);
        setElevesDevant([]);

        setPlaces(function (actuelles) {
          return actuelles.map(function (place, index) {
            return {
              ...place,
              eleveId: nouveauxEleves[index]?.id ?? null,
              verrouillee: false,
            };
          });
        });
      },
    });

    event.target.value = "";
  }

  function appliquerDisposition(
    nouvellesPlaces: Place[],
    nouveauMode: ModeSalle,
  ) {
    const nombreElevesActuellementPlaces = places.filter(function (place) {
      return place.eleveId !== null;
    }).length;

    if (nombreElevesActuellementPlaces > 0) {
      const nombreQuiNePourrontPasEtrePlaces = Math.max(
        0,
        nombreElevesActuellementPlaces - nouvellesPlaces.length,
      );

      const message =
        nombreQuiNePourrontPasEtrePlaces > 0
          ? `Changer de disposition va réorganiser la salle. ${nombreQuiNePourrontPasEtrePlaces} élève(s) actuellement placé(s) n'auront plus de table et apparaîtront comme non placés. Les verrouillages seront aussi retirés. Continuer ?`
          : "Changer de disposition va réorganiser les tables et retirer les verrouillages actuels. Les élèves resteront dans la classe et seront replacés dans le nouvel agencement. Continuer ?";

      if (!window.confirm(message)) {
        return;
      }
    }

    memoriserEtatSalle();

    const elevesPlaces = places
      .map(function (place) {
        return place.eleveId;
      })
      .filter(function (id): id is number {
        return id !== null;
      });

    setPlaces(
      nouvellesPlaces.map(function (place, index) {
        return {
          ...place,

          eleveId: elevesPlaces[index] ?? null,

          verrouillee: false,
        };
      }),
    );

    setModeSalle(nouveauMode);

    setTablesSelectionnees([]);
  }

  function redistribuerHauteurRangees(placesActuelles: Place[]): Place[] {
    const anciennesRangees = Array.from(
      new Set(
        placesActuelles.map(function (place) {
          return place.y;
        }),
      ),
    ).sort(function (a, b) {
      return a - b;
    });

    const nouvellesPositions = positionsYPourNombreRangees(
      anciennesRangees.length,
    );
    const correspondances = new Map<number, number>();

    anciennesRangees.forEach(function (anciennePosition, index) {
      correspondances.set(anciennePosition, nouvellesPositions[index]);
    });

    return placesActuelles.map(function (place) {
      return {
        ...place,
        y: correspondances.get(place.y) ?? place.y,
      };
    });
  }

  function ajouterRangeeSalle() {
    if (modeSalle !== "classique" || nombreRangeesSalle >= 8) {
      return;
    }

    memoriserEtatSalle();

    const derniereRangeeY = rangeesSalle[rangeesSalle.length - 1];
    const modeleDerniereRangee = places
      .filter(function (place) {
        return Math.abs(place.y - derniereRangeeY) < 0.6;
      })
      .sort(function (a, b) {
        return a.x - b.x;
      });

    const prochainId =
      places.reduce(function (maximum, place) {
        return Math.max(maximum, place.id);
      }, 0) + 1;

    const yTemporaire = 1000 + nombreRangeesSalle;

    const nouvellesTables = modeleDerniereRangee.map(function (place, index) {
      return {
        id: prochainId + index,
        x: place.x,
        y: yTemporaire,
        eleveId: null,
        verrouillee: false,
      };
    });

    setPlaces(redistribuerHauteurRangees([...places, ...nouvellesTables]));
  }

  function supprimerDerniereRangeeSalle() {
    if (modeSalle !== "classique" || nombreRangeesSalle <= 1) {
      return;
    }

    const derniereRangeeY = rangeesSalle[rangeesSalle.length - 1];

    const rangeeASupprimer = places.filter(function (place) {
      return Math.abs(place.y - derniereRangeeY) < 0.6;
    });

    const contientEleves = rangeeASupprimer.some(function (place) {
      return place.eleveId !== null;
    });

    if (contientEleves) {
      const confirmation = window.confirm(
        "Cette rangée contient des élèves. La supprimer retirera leurs tables du plan, mais les élèves resteront dans la liste et pourront être replacés. Continuer ?",
      );

      if (!confirmation) {
        return;
      }
    }

    memoriserEtatSalle();

    const restantes = places.filter(function (place) {
      return Math.abs(place.y - derniereRangeeY) >= 0.6;
    });

    setPlaces(redistribuerHauteurRangees(restantes));
    setTablesSelectionnees([]);
  }

  function ajouterTable() {
    const prochainId =
      places.reduce(function (maximum, place) {
        return Math.max(maximum, place.id);
      }, 0) + 1;

    if (modeSalle === "classique") {
      const rangees = Array.from(
        new Set(
          places.map(function (place) {
            return place.y;
          }),
        ),
      ).sort(function (a, b) {
        return a - b;
      });

      for (const y of rangees) {
        for (const zone of ["gauche", "centre", "droite"] as ZoneSalle[]) {
          const bloc = tablesDuBloc(places, y, zone);

          if (bloc.length >= capaciteZone(zone)) {
            continue;
          }

          memoriserEtatSalle();

          let nouvellesPlaces: Place[] = [
            ...places,

            {
              id: prochainId,

              x: zone === "centre" ? 50 : zone === "gauche" ? 24 : 76,

              y,

              eleveId: null,

              verrouillee: false,
            },
          ];

          nouvellesPlaces = normaliserBloc(nouvellesPlaces, y, zone);

          setPlaces(nouvellesPlaces);

          return;
        }
      }
    }

    for (const y of POINTS_Y) {
      for (const x of POINTS_X) {
        const occupe = places.some(function (place) {
          return Math.abs(place.x - x) < 0.5 && Math.abs(place.y - y) < 0.5;
        });

        if (!occupe) {
          memoriserEtatSalle();

          setPlaces([
            ...places,

            {
              id: prochainId,

              x,
              y,

              eleveId: null,

              verrouillee: false,
            },
          ]);

          return;
        }
      }
    }
  }

  function supprimerTablesSelectionnees() {
    if (tablesSelectionnees.length === 0) {
      return;
    }

    const nombreElevesConcernes = places.filter(function (place) {
      return tablesSelectionnees.includes(place.id) && place.eleveId !== null;
    }).length;

    if (nombreElevesConcernes > 0) {
      const confirmation = window.confirm(
        `Supprimer ces tables retirera ${nombreElevesConcernes} élève(s) du plan. Ils resteront dans la classe et apparaîtront comme non placés. Continuer ?`,
      );

      if (!confirmation) {
        return;
      }
    }

    memoriserEtatSalle();

    let nouvellesPlaces = places.filter(function (place) {
      return !tablesSelectionnees.includes(place.id);
    });

    if (modeSalle === "classique") {
      nouvellesPlaces = normaliserToutesLesRangees(nouvellesPlaces);
    }

    setPlaces(nouvellesPlaces);

    setTablesSelectionnees([]);
  }

  function positionDansSalle(clientX: number, clientY: number) {
    const element = salleRef.current;

    if (!element) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect = element.getBoundingClientRect();

    const x = ((clientX - rect.left) / rect.width) * 100;

    const y = ((clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),

      y: Math.max(0, Math.min(100, y)),
    };
  }

  function trouverPointLibreLePlusProche(
    x: number,
    y: number,
    placeIgnoreeId: number,
  ) {
    let meilleur: {
      x: number;
      y: number;
      distance: number;
    } | null = null;

    POINTS_Y.forEach(function (pointY) {
      POINTS_X.forEach(function (pointX) {
        const occupe = places.some(function (place) {
          if (place.id === placeIgnoreeId) {
            return false;
          }

          return (
            Math.abs(place.x - pointX) < 0.5 && Math.abs(place.y - pointY) < 0.5
          );
        });

        if (occupe) {
          return;
        }

        const dx = pointX - x;

        const dy = pointY - y;

        const distance = dx * dx + dy * dy;

        if (meilleur === null || distance < meilleur.distance) {
          meilleur = {
            x: pointX,
            y: pointY,
            distance,
          };
        }
      });
    });

    return meilleur;
  }

  function trouverPointGrilleLePlusProche(x: number, y: number) {
    let meilleur = {
      x: POINTS_X[0],
      y: POINTS_Y[0],
      distance: Number.POSITIVE_INFINITY,
    };

    POINTS_Y.forEach(function (pointY) {
      POINTS_X.forEach(function (pointX) {
        const dx = pointX - x;
        const dy = pointY - y;
        const distance = dx * dx + dy * dy;

        if (distance < meilleur.distance) {
          meilleur = {
            x: pointX,
            y: pointY,
            distance,
          };
        }
      });
    });

    return meilleur;
  }

  function calculerDeplacementLibreAligne(clientX: number, clientY: number) {
    if (tableDeplaceeId === null) {
      return null;
    }

    const tableAncre = places.find(function (place) {
      return place.id === tableDeplaceeId;
    });

    if (!tableAncre) {
      return null;
    }

    const idsSelectionnes = new Set<number>(
      tablesSelectionnees.includes(tableDeplaceeId)
        ? tablesSelectionnees
        : [tableDeplaceeId],
    );

    const position = positionDansSalle(clientX, clientY);
    const cibleGrille = trouverPointGrilleLePlusProche(position.x, position.y);

    let decalageX = cibleGrille.x - tableAncre.x;
    let decalageY = cibleGrille.y - tableAncre.y;

    const selection = places.filter(function (place) {
      return idsSelectionnes.has(place.id);
    });

    const autresTables = places.filter(function (place) {
      return !idsSelectionnes.has(place.id);
    });

    /*
      Aimant d'alignement : si une table déplacée passe à proximité
      de l'axe horizontal ou vertical d'une autre table, tout le groupe
      s'aligne précisément sur cet axe.
    */
    const SEUIL_AIMANT = 2.8;

    let meilleurAjustementX: number | null = null;
    let repereX: number | null = null;

    let meilleurAjustementY: number | null = null;
    let repereY: number | null = null;

    selection.forEach(function (placeSelectionnee) {
      const xProjete = placeSelectionnee.x + decalageX;
      const yProjete = placeSelectionnee.y + decalageY;

      autresTables.forEach(function (autre) {
        const ajustementX = autre.x - xProjete;
        const ajustementY = autre.y - yProjete;

        if (
          Math.abs(ajustementX) <= SEUIL_AIMANT &&
          (meilleurAjustementX === null ||
            Math.abs(ajustementX) < Math.abs(meilleurAjustementX))
        ) {
          meilleurAjustementX = ajustementX;
          repereX = autre.x;
        }

        if (
          Math.abs(ajustementY) <= SEUIL_AIMANT &&
          (meilleurAjustementY === null ||
            Math.abs(ajustementY) < Math.abs(meilleurAjustementY))
        ) {
          meilleurAjustementY = ajustementY;
          repereY = autre.y;
        }
      });
    });

    if (meilleurAjustementX !== null) {
      decalageX += meilleurAjustementX;
    }

    if (meilleurAjustementY !== null) {
      decalageY += meilleurAjustementY;
    }

    /*
      Aimant "bord à bord" pour les îlots : après l'alignement des axes,
      si une table arrive près du côté gauche ou droit d'une autre table,
      on lui propose automatiquement une position compacte à 6 unités.
      Cela permet de remettre intuitivement une table dans un îlot.
    */
    if (selection.length === 1) {
      const placeSelectionnee = selection[0];
      const xProjete = placeSelectionnee.x + decalageX;
      const yProjete = placeSelectionnee.y + decalageY;

      let meilleurCollage:
        | {
            ajustementX: number;
            ajustementY: number;
            cibleX: number;
            cibleY: number;
            distance: number;
          }
        | null = null;

      autresTables.forEach(function (autre) {
        [-6, 6].forEach(function (ecartX) {
          const cibleX = autre.x + ecartX;
          const cibleY = autre.y;
          const dx = cibleX - xProjete;
          const dy = cibleY - yProjete;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (
            distance <= 4.2 &&
            (meilleurCollage === null || distance < meilleurCollage.distance)
          ) {
            meilleurCollage = {
              ajustementX: dx,
              ajustementY: dy,
              cibleX,
              cibleY,
              distance,
            };
          }
        });
      });

      if (meilleurCollage !== null) {
        decalageX += meilleurCollage.ajustementX;
        decalageY += meilleurCollage.ajustementY;
        repereX = meilleurCollage.cibleX;
        repereY = meilleurCollage.cibleY;
      }
    }

    return {
      idsSelectionnes,
      decalageX,
      decalageY,
      repereX,
      repereY,
    };
  }

  function mettreAJourReperesAlignement(clientX: number, clientY: number) {
    if (tableDeplaceeId === null) {
      setReperesAlignement({ x: null, y: null });
      return;
    }

    if (
      modeSalle === "classique" &&
      tablesSelectionnees.length > 1 &&
      tablesSelectionnees.includes(tableDeplaceeId)
    ) {
      const deplacement = calculerDeplacementGroupeClassique(clientX, clientY);

      setReperesAlignement({
        x: deplacement?.repereX ?? null,
        y: deplacement?.repereY ?? null,
      });
      return;
    }

    if (modeSalle !== "libre") {
      setReperesAlignement({ x: null, y: null });
      return;
    }

    const position = positionDansSalle(clientX, clientY);
    const deplacement = calculerDeplacementLibreAligne(clientX, clientY);

    const guideExtremiteY =
      tablesSelectionnees.length <= 1
        ? position.y <= 8
          ? 6
          : position.y >= 92
            ? 94
            : null
        : null;

    setReperesAlignement({
      x: deplacement?.repereX ?? null,
      y: guideExtremiteY ?? deplacement?.repereY ?? null,
    });
  }

  function deposerGroupeTables(clientX: number, clientY: number): boolean {
    if (
      modeSalle !== "libre" ||
      tableDeplaceeId === null ||
      tablesSelectionnees.length <= 1 ||
      !tablesSelectionnees.includes(tableDeplaceeId)
    ) {
      return false;
    }

    const tableAncre = places.find(function (place) {
      return place.id === tableDeplaceeId;
    });

    if (!tableAncre) {
      return false;
    }

    const deplacement = calculerDeplacementLibreAligne(clientX, clientY);

    if (!deplacement) {
      return false;
    }

    const decalageX = deplacement.decalageX;
    const decalageY = deplacement.decalageY;

    if (Math.abs(decalageX) < 0.1 && Math.abs(decalageY) < 0.1) {
      return true;
    }

    const idsSelectionnes = new Set(tablesSelectionnees);

    const nouvellesPositions = places
      .filter(function (place) {
        return idsSelectionnes.has(place.id);
      })
      .map(function (place) {
        return {
          id: place.id,
          x: place.x + decalageX,
          y: place.y + decalageY,
        };
      });

    const horsSalle = nouvellesPositions.some(function (positionTable) {
      return (
        positionTable.x < 6 ||
        positionTable.x > 94 ||
        positionTable.y < 6 ||
        positionTable.y > 94
      );
    });

    if (horsSalle) {
      return true;
    }

    const autresTables = places.filter(function (place) {
      return !idsSelectionnes.has(place.id);
    });

    const collision = nouvellesPositions.some(function (positionTable) {
      return autresTables.some(function (autre) {
        return (
          Math.abs(positionTable.x - autre.x) < 5.7 &&
          Math.abs(positionTable.y - autre.y) < 10
        );
      });
    });

    if (collision) {
      return true;
    }

    const positionParId = new Map<
      number,
      {
        x: number;
        y: number;
      }
    >();

    nouvellesPositions.forEach(function (positionTable) {
      positionParId.set(positionTable.id, {
        x: positionTable.x,
        y: positionTable.y,
      });
    });

    memoriserEtatSalle();

    setPlaces(
      places.map(function (place) {
        const nouvellePosition = positionParId.get(place.id);

        if (!nouvellePosition) {
          return place;
        }

        return {
          ...place,
          x: nouvellePosition.x,
          y: nouvellePosition.y,
        };
      }),
    );

    return true;
  }

  function deposerTableSurNouvelleRangeeExtremite(
    clientX: number,
    clientY: number,
  ): boolean {
    if (
      modeSalle !== "libre" ||
      tableDeplaceeId === null ||
      tablesSelectionnees.length > 1
    ) {
      return false;
    }

    const position = positionDansSalle(clientX, clientY);

    // On ne déclenche cette logique que lorsque l'utilisateur vise
    // clairement le bord supérieur ou inférieur de la salle.
    const ajouterDevant = position.y <= 8;
    const ajouterDerriere = position.y >= 92;

    if (!ajouterDevant && !ajouterDerriere) {
      return false;
    }

    const tableDeplacee = places.find(function (place) {
      return place.id === tableDeplaceeId;
    });

    if (!tableDeplacee) {
      return false;
    }

    const autresTables = places.filter(function (place) {
      return place.id !== tableDeplaceeId;
    });

    if (autresTables.length === 0) {
      return false;
    }

    const cibleX = trouverPointGrilleLePlusProche(position.x, position.y).x;

    // On crée réellement de la place : les tables existantes sont légèrement
    // resserrées dans la zone centrale et la nouvelle rangée prend le bord.
    // La hauteur en pixels augmente ensuite automatiquement grâce au nouveau y.
    const minimumY = Math.min(
      ...autresTables.map(function (place) {
        return place.y;
      }),
    );
    const maximumY = Math.max(
      ...autresTables.map(function (place) {
        return place.y;
      }),
    );

    const nouvelleBorneMin = ajouterDevant ? 18 : 8;
    const nouvelleBorneMax = ajouterDevant ? 92 : 82;
    const cibleY = ajouterDevant ? 6 : 94;

    function recalculerY(y: number): number {
      if (Math.abs(maximumY - minimumY) < 0.1) {
        return (nouvelleBorneMin + nouvelleBorneMax) / 2;
      }

      const ratio = (y - minimumY) / (maximumY - minimumY);
      return nouvelleBorneMin + ratio * (nouvelleBorneMax - nouvelleBorneMin);
    }

    const collisionHorizontale = autresTables.some(function (autre) {
      return (
        Math.abs(cibleX - autre.x) < 7.5 &&
        Math.abs(cibleY - recalculerY(autre.y)) < 10
      );
    });

    if (collisionHorizontale) {
      return false;
    }

    memoriserEtatSalle();

    setPlaces(
      places.map(function (place) {
        if (place.id === tableDeplaceeId) {
          return {
            ...place,
            x: cibleX,
            y: cibleY,
          };
        }

        return {
          ...place,
          y: recalculerY(place.y),
        };
      }),
    );

    setReperesAlignement({ x: cibleX, y: cibleY });

    return true;
  }

  function calculerDeplacementGroupeClassique(
    clientX: number,
    clientY: number,
  ) {
    if (
      modeSalle !== "classique" ||
      tableDeplaceeId === null ||
      tablesSelectionnees.length <= 1 ||
      !tablesSelectionnees.includes(tableDeplaceeId)
    ) {
      return null;
    }

    const tableAncre = places.find(function (place) {
      return place.id === tableDeplaceeId;
    });

    if (!tableAncre) {
      return null;
    }

    const position = positionDansSalle(clientX, clientY);

    /*
      Important : on ne cherche plus une colonne déjà existante.
      C'était la cause du comportement peu intuitif : une colonne sélectionnée
      ne pouvait se déplacer que vers un x déjà occupé, donc souvent en collision.

      On utilise maintenant la même grille horizontale fine que le mode libre.
      Une colonne peut donc créer directement un nouvel alignement (par exemple
      passer de x=42 à x=34/36/38) sans devoir déplacer d'abord une table seule.
    */
    const cibleX = trouverPointGrilleLePlusProche(position.x, tableAncre.y).x;

    const rangees: number[] = Array.from(
      new Set<number>(
        places.map(function (place) {
          return place.y;
        }),
      ),
    ).sort(function (a, b) {
      return a - b;
    });

    let cibleY = tableAncre.y;

    if (rangees.length > 0) {
      let meilleureDistance = Number.POSITIVE_INFINITY;

      rangees.forEach(function (y) {
        const distance = Math.abs(position.y - y);

        if (distance < meilleureDistance) {
          cibleY = y;
          meilleureDistance = distance;
        }
      });
    }

    const decalageX = cibleX - tableAncre.x;
    const decalageY = cibleY - tableAncre.y;

    return {
      decalageX,
      decalageY,
      repereX: cibleX,
      repereY: Math.abs(decalageY) > 0.1 ? cibleY : null,
    };
  }

  function deposerGroupeTablesClassique(
    clientX: number,
    clientY: number,
  ): boolean {
    const deplacement = calculerDeplacementGroupeClassique(clientX, clientY);

    if (!deplacement) {
      return false;
    }

    const decalageX = deplacement.decalageX;
    const decalageY = deplacement.decalageY;

    if (Math.abs(decalageX) < 0.1 && Math.abs(decalageY) < 0.1) {
      return true;
    }

    const idsSelectionnes = new Set(tablesSelectionnees);

    const nouvellesPositions = places
      .filter(function (place) {
        return idsSelectionnes.has(place.id);
      })
      .map(function (place) {
        return {
          id: place.id,
          x: place.x + decalageX,
          y: place.y + decalageY,
        };
      });

    const horsSalle = nouvellesPositions.some(function (positionTable) {
      return (
        positionTable.x < 6 ||
        positionTable.x > 94 ||
        positionTable.y < 6 ||
        positionTable.y > 94
      );
    });

    if (horsSalle) {
      return true;
    }

    const autresTables = places.filter(function (place) {
      return !idsSelectionnes.has(place.id);
    });

    const collision = nouvellesPositions.some(function (positionTable) {
      return autresTables.some(function (autre) {
        return (
          Math.abs(positionTable.x - autre.x) < 7.5 &&
          Math.abs(positionTable.y - autre.y) < 10
        );
      });
    });

    if (collision) {
      return true;
    }

    const positionParId = new Map<
      number,
      {
        x: number;
        y: number;
      }
    >();

    nouvellesPositions.forEach(function (positionTable) {
      positionParId.set(positionTable.id, {
        x: positionTable.x,
        y: positionTable.y,
      });
    });

    memoriserEtatSalle();

    setPlaces(
      places.map(function (place) {
        const nouvellePosition = positionParId.get(place.id);

        if (!nouvellePosition) {
          return place;
        }

        return {
          ...place,
          x: nouvellePosition.x,
          y: nouvellePosition.y,
        };
      }),
    );

    return true;
  }

  function deposerTableDansSalle(clientX: number, clientY: number) {
    if (tableDeplaceeId === null) {
      return;
    }

    if (deposerTableSurNouvelleRangeeExtremite(clientX, clientY)) {
      setTableDeplaceeId(null);
      window.setTimeout(function () {
        setReperesAlignement({ x: null, y: null });
      }, 350);
      return;
    }

    if (deposerGroupeTables(clientX, clientY)) {
      setTableDeplaceeId(null);
      setReperesAlignement({ x: null, y: null });
      return;
    }

    if (deposerGroupeTablesClassique(clientX, clientY)) {
      setTableDeplaceeId(null);
      setReperesAlignement({ x: null, y: null });
      return;
    }

    const position = positionDansSalle(clientX, clientY);

    if (modeSalle === "classique") {
      const autresTables = places.filter(function (place) {
        return place.id !== tableDeplaceeId;
      });

      const rangeeY = trouverRangeeProche(position.y, autresTables);

      if (rangeeY !== null) {
        const zone = determinerZone(position.x);

        const nouvelleDisposition = deplacerTableClassique(
          places,
          tableDeplaceeId,
          rangeeY,
          zone,
          position.x,
        );

        if (nouvelleDisposition) {
          const ancienneTable = places.find(function (place) {
            return place.id === tableDeplaceeId;
          });

          const nouvelleTable = nouvelleDisposition.find(function (place) {
            return place.id === tableDeplaceeId;
          });

          const vraimentModifie =
            ancienneTable &&
            nouvelleTable &&
            (Math.abs(ancienneTable.x - nouvelleTable.x) > 0.1 ||
              Math.abs(ancienneTable.y - nouvelleTable.y) > 0.1);

          if (vraimentModifie) {
            memoriserEtatSalle();

            setPlaces(nouvelleDisposition);
          }

          setTableDeplaceeId(null);

          return;
        }
      }
    }

    const deplacementLibre = calculerDeplacementLibreAligne(clientX, clientY);

    const ancienneTable = places.find(function (place) {
      return place.id === tableDeplaceeId;
    });

    if (!deplacementLibre || !ancienneTable) {
      setTableDeplaceeId(null);
      setReperesAlignement({ x: null, y: null });
      return;
    }

    const cible = {
      x: ancienneTable.x + deplacementLibre.decalageX,
      y: ancienneTable.y + deplacementLibre.decalageY,
    };

    const collision = places.some(function (autre) {
      if (autre.id === tableDeplaceeId) {
        return false;
      }

      return (
        Math.abs(cible.x - autre.x) < 5.7 &&
        Math.abs(cible.y - autre.y) < 10
      );
    });

    if (
      collision ||
      cible.x < 6 ||
      cible.x > 94 ||
      cible.y < 6 ||
      cible.y > 94
    ) {
      setTableDeplaceeId(null);
      setReperesAlignement({ x: null, y: null });
      return;
    }

    if (
      ancienneTable &&
      (Math.abs(ancienneTable.x - cible.x) > 0.1 ||
        Math.abs(ancienneTable.y - cible.y) > 0.1)
    ) {
      memoriserEtatSalle();

      setPlaces(
        places.map(function (place) {
          if (place.id !== tableDeplaceeId) {
            return place;
          }

          return {
            ...place,
            x: cible.x,
            y: cible.y,
          };
        }),
      );
    }

    setTableDeplaceeId(null);
    setReperesAlignement({ x: null, y: null });
  }

  function commencerRectangleSelection(clientX: number, clientY: number) {
    if (tableDeplaceeId !== null) {
      return;
    }

    const position = positionDansSalle(clientX, clientY);

    setRectangleSelection({
      debutX: position.x,

      debutY: position.y,

      finX: position.x,

      finY: position.y,
    });
  }

  function mettreAJourRectangleSelection(clientX: number, clientY: number) {
    if (!rectangleSelection) {
      return;
    }

    const position = positionDansSalle(clientX, clientY);

    setRectangleSelection(function (actuel) {
      if (!actuel) {
        return null;
      }

      return {
        ...actuel,
        finX: position.x,
        finY: position.y,
      };
    });
  }

  function terminerRectangleSelection() {
    if (!rectangleSelection) {
      return;
    }

    const minimumX = Math.min(
      rectangleSelection.debutX,
      rectangleSelection.finX,
    );

    const maximumX = Math.max(
      rectangleSelection.debutX,
      rectangleSelection.finX,
    );

    const minimumY = Math.min(
      rectangleSelection.debutY,
      rectangleSelection.finY,
    );

    const maximumY = Math.max(
      rectangleSelection.debutY,
      rectangleSelection.finY,
    );

    if (maximumX - minimumX < 1 && maximumY - minimumY < 1) {
      setTablesSelectionnees([]);
      setRectangleSelection(null);

      return;
    }

    setTablesSelectionnees(
      places
        .filter(function (place) {
          return (
            place.x >= minimumX &&
            place.x <= maximumX &&
            place.y >= minimumY &&
            place.y <= maximumY
          );
        })
        .map(function (place) {
          return place.id;
        }),
    );

    setRectangleSelection(null);
  }

  function imprimerPlan() {
    const ancienTitre = document.title;

    document.title = `Plan de classe - ${nomProjet || "Classe"}`;

    window.print();

    window.setTimeout(function () {
      document.title = ancienTitre;
    }, 500);
  }

  if (vue === "classes") {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold text-slate-800">
            🏫 Plan de Classe
          </h1>

          <p className="mt-2 text-slate-500">
            Choisis une classe pour ouvrir son plan.
          </p>

          <section className="mb-8 mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">➕ Nouvelle classe</h2>

            <div className="flex gap-3">
              <input
                value={nomNouvelleClasse}
                onChange={function (event) {
                  setNomNouvelleClasse(event.target.value);
                }}
                onKeyDown={function (event) {
                  if (event.key === "Enter") {
                    creerNouvelleClasse();
                  }
                }}
                placeholder="Ex. 5e A"
                className="flex-1 rounded-lg border p-3"
              />

              <button
                onClick={creerNouvelleClasse}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white"
              >
                Créer
              </button>
            </div>
          </section>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-800">📥 Importer une classe</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Réouvre un fichier .planclasse pour retrouver les élèves, les tables et les règles.
                </p>
              </div>

              <label className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700">
                Choisir un fichier .planclasse
                <input
                  type="file"
                  accept=".planclasse,.json,application/json"
                  onChange={importerProjet}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <h2 className="mb-4 text-2xl font-bold">📚 Mes classes</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projets.map(function (projet) {
              return (
                <article
                  key={projet.id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <h3 className="text-xl font-bold">{projet.nom}</h3>

                  <p className="mb-5 mt-1 text-sm text-gray-500">
                    {projet.eleves.length} élève
                    {projet.eleves.length > 1 ? "s" : ""}
                  </p>

                  <button
                    onClick={function () {
                      ouvrirProjet(projet);
                    }}
                    className="mb-2 w-full rounded-lg bg-slate-700 p-3 font-semibold text-white"
                  >
                    Ouvrir la classe
                  </button>

                  <button
                    onClick={function () {
                      exporterProjet(projet);
                    }}
                    className="mb-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    💾 Exporter la classe
                  </button>

                  <button
                    onClick={function () {
                      supprimerProjet(projet.id);
                    }}
                    className="w-full p-2 text-sm text-red-600"
                  >
                    🗑️ Supprimer
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-8 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          .zone-plan-impression {
            height: 170mm !important;
            min-height: 0 !important;
          }

          .place-plan-impression {
            left: var(--position-x-export) !important;
            width: 24mm !important;
          }

          .impression-vue-professeur .place-plan-impression {
            left: calc(100% - var(--position-x-export)) !important;
            top: calc(100% - var(--position-y)) !important;
          }

          .impression-vue-professeur .tableau-plan-impression {
            top: auto !important;
            bottom: 12px !important;
          }
        }
      `}</style>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-bold">🏫 Plan de Classe</h1>

          <div className="mt-1 flex gap-3 text-sm">
            <strong>{nomProjet}</strong>

            <span
              className={
                statutSauvegarde === "enregistrement"
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            >
              {statutSauvegarde === "enregistrement"
                ? "● Enregistrement…"
                : "✓ Enregistré automatiquement"}
            </span>
          </div>
        </div>

        <button
          onClick={function () {
            setVue("classes");
          }}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          ← Revenir à Mes classes
        </button>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 print:hidden">
        <button
          onClick={function () {
            setVue("plan");
          }}
          className={
            "rounded-lg px-4 py-2.5 font-semibold " +
            (vue === "plan"
              ? "bg-slate-700 text-white shadow"
              : "bg-gray-200 text-gray-700")
          }
        >
          🪑 Plan général
        </button>

        <button
          onClick={function () {
            setVue("salle");
          }}
          className={
            "rounded-lg px-4 py-2.5 font-semibold " +
            (vue === "salle"
              ? "bg-purple-600 text-white shadow"
              : "bg-gray-200 text-gray-700")
          }
        >
          ✏️ Modifier la salle
        </button>

        <button
          onClick={function () {
            setVue("eleves");
          }}
          className={
            "rounded-lg px-4 py-2.5 font-semibold " +
            (vue === "eleves"
              ? "bg-blue-600 text-white shadow"
              : "bg-gray-200 text-gray-700")
          }
        >
          👩‍🎓 Modifier les élèves
        </button>
      </nav>

      {vue === "salle" && (
        <section className="rounded-2xl border border-purple-300 bg-purple-100 p-6">
          <h2 className="text-2xl font-bold text-purple-950">
            ✏️ Modifier la salle
          </h2>

          <p className="mt-1 text-sm text-purple-800">
            Déplace les tables, clique sur une table pour la sélectionner ou
            trace un rectangle pour en sélectionner plusieurs. En mode libre, tu peux
            aussi déposer une table tout en haut ou tout en bas : la surface s’agrandira
            automatiquement, avec les mêmes repères d’alignement. En mode libre,
            des repères apparaissent pendant le déplacement pour aligner
            facilement les tables en lignes ou en colonnes.
          </p>

          <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50/70 p-3">
            <p className="mb-3 text-xs font-medium text-purple-700">
              Choisissez une disposition de départ à éditer :
            </p>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-purple-200 bg-white/70 p-3">
                <div className="mb-2">
                  <p className="text-sm font-bold text-purple-950">
                    Dispositions classiques avec couloir
                  </p>
                  <p className="mt-0.5 text-xs text-purple-600">
                    Rangées guidées, avec ajout ou retrait de rangées.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={function () {
                      appliquerDisposition(
                        creerDispositionClassique(),
                        "classique",
                      );
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-4 py-2.5 font-semibold text-purple-800 shadow-sm hover:bg-purple-50"
                  >
                    2 | 4 | 2
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(creerDisposition232(), "classique");
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-4 py-2.5 font-semibold text-purple-800 shadow-sm hover:bg-purple-50"
                  >
                    2 | 3 | 2
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(creerDisposition222(), "classique");
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-4 py-2.5 font-semibold text-purple-800 shadow-sm hover:bg-purple-50"
                  >
                    2 | 2 | 2
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <div className="mb-2">
                  <p className="text-sm font-bold text-indigo-950">Mode libre</p>
                  <p className="mt-0.5 text-xs text-indigo-600">
                    Déplacez et alignez librement les tables avec les guides.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={function () {
                      appliquerDisposition(creerDisposition44(), "libre");
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
                  >
                    4 | 4
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(
                        creerDispositionRangeesSimples(),
                        "libre",
                      );
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
                  >
                    Rangées simples
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(creerDispositionIlots4(), "libre");
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
                  >
                    Îlots de 4
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(creerDispositionIlots5(), "libre");
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
                  >
                    Îlots de 5
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(creerDispositionU(), "libre");
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
                  >
                    Salle en U
                  </button>

                  <button
                    onClick={function () {
                      appliquerDisposition(creerDispositionDeuxU(), "libre");
                    }}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
                  >
                    Deux U emboîtés
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="my-4 flex flex-wrap items-center gap-2">
            <button
              onClick={ajouterTable}
              className="rounded-lg bg-purple-600 px-4 py-2.5 font-semibold text-white"
            >
              ➕ Ajouter une table
            </button>

            {modeSalle === "classique" && (
              <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-sm text-purple-900">
                <button
                  onClick={supprimerDerniereRangeeSalle}
                  disabled={nombreRangeesSalle <= 1}
                  className="rounded px-2 py-1 font-semibold hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Retirer la dernière rangée"
                >
                  −
                </button>

                <span className="min-w-[92px] text-center font-semibold">
                  {nombreRangeesSalle} rangée{nombreRangeesSalle > 1 ? "s" : ""}
                </span>

                <button
                  onClick={ajouterRangeeSalle}
                  disabled={nombreRangeesSalle >= 8}
                  className="rounded px-2 py-1 font-semibold hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Ajouter une rangée (8 maximum)"
                >
                  +
                </button>
              </div>
            )}

            {tablesSelectionnees.length > 0 && (
              <button
                onClick={supprimerTablesSelectionnees}
                className="ml-auto rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white"
              >
                🗑️ Supprimer {tablesSelectionnees.length}
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5">
            <div className="mb-4 rounded-lg bg-gray-800 p-3 text-center font-semibold text-white">
              TABLEAU
            </div>

            <div
              ref={salleRef}
              onMouseDown={function (event) {
                if (event.target === event.currentTarget) {
                  commencerRectangleSelection(event.clientX, event.clientY);
                }
              }}
              onMouseMove={function (event) {
                mettreAJourRectangleSelection(event.clientX, event.clientY);
              }}
              onMouseUp={terminerRectangleSelection}
              onMouseLeave={function () {
                if (rectangleSelection) {
                  terminerRectangleSelection();
                }
              }}
              onDragOver={function (event) {
                if (tableDeplaceeId !== null) {
                  event.preventDefault();
                  mettreAJourReperesAlignement(event.clientX, event.clientY);
                }
              }}
              onDrop={function (event) {
                event.preventDefault();

                deposerTableDansSalle(event.clientX, event.clientY);
              }}
              style={{ minHeight: hauteurSallePixels + "px" }}
              className="relative select-none overflow-hidden rounded-xl border border-purple-200 bg-purple-50"
            >
              {tableDeplaceeId !== null &&
                modeSalle === "libre" &&
                reperesAlignement.x !== null && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-10 w-px -translate-x-1/2 bg-purple-500/70"
                    style={{ left: reperesAlignement.x + "%" }}
                  />
                )}

              {tableDeplaceeId !== null &&
                modeSalle === "libre" &&
                reperesAlignement.y !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 h-px -translate-y-1/2 bg-purple-500/70"
                    style={{ top: reperesAlignement.y + "%" }}
                  />
                )}

              {tableDeplaceeId !== null &&
                POINTS_Y.flatMap(function (y) {
                  return POINTS_X.map(function (x) {
                    return (
                      <div
                        key={`${x}-${y}`}
                        style={{
                          left: x + "%",
                          top: y + "%",
                        }}
                        className="pointer-events-none absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500 opacity-15"
                      />
                    );
                  });
                })}

              {rectangleSelection && (
                <div
                  className="pointer-events-none absolute z-30 border-2 border-purple-500 bg-purple-300/20"
                  style={{
                    left:
                      Math.min(
                        rectangleSelection.debutX,
                        rectangleSelection.finX,
                      ) + "%",

                    top:
                      Math.min(
                        rectangleSelection.debutY,
                        rectangleSelection.finY,
                      ) + "%",

                    width:
                      Math.abs(
                        rectangleSelection.finX - rectangleSelection.debutX,
                      ) + "%",

                    height:
                      Math.abs(
                        rectangleSelection.finY - rectangleSelection.debutY,
                      ) + "%",
                  }}
                />
              )}

              {places.map(function (place) {
                const selectionnee = tablesSelectionnees.includes(place.id);

                return (
                  <div
                    key={place.id}
                    draggable
                    onClick={function (event) {
                      event.stopPropagation();

                      setTablesSelectionnees(function (actuelles) {
                        if (actuelles.includes(place.id)) {
                          return actuelles.filter(function (id) {
                            return id !== place.id;
                          });
                        }

                        return [place.id];
                      });
                    }}
                    onDragStart={function () {
                      setTableDeplaceeId(place.id);
                      setReperesAlignement({ x: null, y: null });

                      setTablesSelectionnees(function (actuelles) {
                        if (actuelles.includes(place.id)) {
                          return actuelles;
                        }

                        return [place.id];
                      });
                    }}
                    onDragEnd={function () {
                      setTableDeplaceeId(null);
                      setReperesAlignement({ x: null, y: null });
                    }}
                    style={{
                      left: place.x + "%",
                      top: place.y + "%",
                    }}
                    className={
                      "absolute z-20 flex h-16 w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-md border-2 text-xs font-semibold shadow-md " +
                      (selectionnee
                        ? "border-purple-700 bg-purple-200 ring-4 ring-purple-300/60"
                        : "border-purple-300 bg-white")
                    }
                  >
                    Table
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-purple-700">
              Clic = sélectionner une table • Glisser une table = déplacer •
              Glisser dans le vide = sélectionner plusieurs • Glisser une table
              sélectionnée = déplacer tout le groupe • ⌘Z / Ctrl Z = annuler la
              dernière modification.
            </p>
          </div>
        </section>
      )}

      {vue === "eleves" && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-blue-950">
              👩‍🎓 Modifier les élèves
            </h2>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={demanderSuppressionTousLesEleves}
                disabled={eleves.length === 0}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                title="Supprimer tous les élèves de cette classe"
              >
                🗑️ Tout supprimer
              </button>

              <button
                onClick={ajouterEleve}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
              >
                ➕ Ajouter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl bg-white">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-blue-100/50 text-left text-xs">
                  <th className="px-3 py-1.5">Prénom</th>

                  <th className="px-3 py-1.5">Nom</th>

                  <th className="w-20 px-2 py-1.5">Sexe</th>

                  <th className="w-20 px-2 py-1.5 text-center">Devant</th>

                  <th className="px-3 py-1.5">🚫 À séparer de</th>

                  <th className="px-3 py-1.5">👥 À placer à côté de</th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {eleves.map(function (eleve) {
                  const partenaires = partenairesDe(eleve.id);

                  const idsPartenaires = partenaires.map(function (partenaire) {
                    return partenaire.id;
                  });

                  const partenairesProximite = partenairesProximiteDe(eleve.id);

                  const idsPartenairesProximite = partenairesProximite.map(
                    function (partenaire) {
                      return partenaire.id;
                    },
                  );

                  const devant = elevesDevant.includes(eleve.id);

                  return (
                    <tr key={eleve.id} className="border-b border-gray-100">
                      <td className="p-1">
                        <input
                          value={eleve.prenom}
                          onChange={function (event) {
                            modifierEleve(
                              eleve.id,
                              "prenom",
                              event.target.value,
                            );
                          }}
                          className="h-8 w-full rounded border px-2"
                        />
                      </td>

                      <td className="p-1">
                        <input
                          value={eleve.nom}
                          onChange={function (event) {
                            modifierEleve(eleve.id, "nom", event.target.value);
                          }}
                          className="h-8 w-full rounded border px-2"
                        />
                      </td>

                      <td className="p-1">
                        <select
                          value={eleve.sexe}
                          onChange={function (event) {
                            modifierEleve(eleve.id, "sexe", event.target.value);
                          }}
                          className="h-8 w-full rounded border"
                        >
                          <option value="">—</option>

                          <option value="F">F</option>

                          <option value="M">M</option>
                        </select>
                      </td>

                      <td className="p-1 text-center">
                        <button
                          onClick={function () {
                            basculerEleveDevant(eleve.id);
                          }}
                          className={
                            "h-8 rounded-lg px-3 text-xs font-semibold transition " +
                            (devant
                              ? "bg-amber-400 text-amber-950"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200")
                          }
                          title={
                            devant
                              ? "Retirer la règle « placer devant »"
                              : "Placer cet élève devant"
                          }
                        >
                          {devant ? "✓ Devant" : "—"}
                        </button>
                      </td>

                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          <div className="flex flex-wrap gap-1">
                            {partenaires.map(function (partenaire) {
                              const contrainte = trouverContrainte(
                                eleve.id,
                                partenaire.id,
                              );

                              return (
                                <button
                                  key={partenaire.id}
                                  onClick={function () {
                                    if (contrainte) {
                                      supprimerContrainte(contrainte.id);
                                    }
                                  }}
                                  className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
                                >
                                  {partenaire.prenom} ✕
                                </button>
                              );
                            })}
                          </div>

                          <select
                            value={associations[eleve.id] ?? ""}
                            onChange={function (event) {
                              choisirSeparationDepuisTable(
                                eleve.id,
                                event.target.value,
                              );
                            }}
                            className="h-8 min-w-[170px] flex-1 rounded border px-2"
                          >
                            <option value="">Ajouter une séparation…</option>

                            {eleves
                              .filter(function (autre) {
                                return (
                                  autre.id !== eleve.id &&
                                  !idsPartenaires.includes(autre.id)
                                );
                              })
                              .map(function (autre) {
                                return (
                                  <option key={autre.id} value={autre.id}>
                                    {autre.prenom} {autre.nom}
                                  </option>
                                );
                              })}
                          </select>
                        </div>
                      </td>

                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          <div className="flex flex-wrap gap-1">
                            {partenairesProximite.map(function (partenaire) {
                              return (
                                <button
                                  key={partenaire.id}
                                  onClick={function () {
                                    retirerRelationProximite(
                                      eleve.id,
                                      partenaire.id,
                                    );
                                  }}
                                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                                  title="Retirer cette règle de proximité"
                                >
                                  {partenaire.prenom} ✕
                                </button>
                              );
                            })}
                          </div>

                          <select
                            value={associationsProximite[eleve.id] ?? ""}
                            onChange={function (event) {
                              choisirProximiteDepuisTable(
                                eleve.id,
                                event.target.value,
                              );
                            }}
                            className="h-8 min-w-[170px] flex-1 rounded border px-2"
                          >
                            <option value="">À placer à côté de…</option>

                            {eleves
                              .filter(function (autre) {
                                return (
                                  autre.id !== eleve.id &&
                                  !idsPartenairesProximite.includes(autre.id)
                                );
                              })
                              .map(function (autre) {
                                return (
                                  <option key={autre.id} value={autre.id}>
                                    {autre.prenom} {autre.nom}
                                  </option>
                                );
                              })}
                          </select>
                        </div>
                      </td>

                      <td className="p-1">
                        <button
                          onClick={function () {
                            demanderSuppressionEleve(eleve);
                          }}
                          className="p-1 text-red-500"
                          title="Supprimer cet élève"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 rounded-lg bg-blue-100/60 px-3 py-2 text-xs text-blue-900">
            💡 Après avoir défini les règles « à séparer » ou « à placer à côté de »,
            appuie sur <strong>« Placement intelligent »</strong> dans le Plan général
            pour générer un placement qui cherche à les respecter.
          </p>

          <label className="mt-3 block cursor-pointer rounded-lg bg-blue-600 p-2 text-center text-sm font-semibold text-white">
            📂 Importer / remplacer par un CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={importerCSV}
              className="hidden"
            />
          </label>


          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-start gap-3">
              <img
                src="data:image/png;base64,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"
                alt="Icône d’export CSV de Pronote"
                className="h-10 w-10 shrink-0"
              />

              <div>
                <h3 className="text-sm font-bold text-violet-950">Importer depuis Pronote</h3>
                <p className="mt-1 text-xs leading-relaxed text-violet-900">
                  Dans Pronote, va dans <strong>« Mes données »</strong>, puis
                  <strong> « Liste des élèves »</strong>. Clique ensuite sur l’icône
                  ci-contre pour exporter la liste au format CSV, puis importe ce fichier ici.
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-violet-800">
              L’application récupère uniquement les informations utiles au plan de classe
              (nom, prénom et sexe). Les autres données présentes dans l’export Pronote sont ignorées.
            </p>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Compatible avec les exports CSV de Pronote ainsi qu’avec un CSV classique
            (Prénom, Nom, Sexe). Si le nom et le prénom sont réunis dans une même colonne,
            les noms de famille écrits en majuscules sont détectés automatiquement.
          </p>

          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            🔒 <strong>Confidentialité :</strong> les données des élèves restent
            stockées localement dans ton navigateur. Elles ne sont pas envoyées au
            concepteur du logiciel et ne lui sont pas visibles.
          </div>
        </section>
      )}

      {vue === "plan" && (
        <div className="grid gap-6 lg:grid-cols-4 print:block">
          {/* PLAN À GAUCHE */}
          <section className="rounded-xl bg-white p-5 shadow lg:col-span-3 print:shadow-none">
            <div className="hidden print:mb-4 print:block">
              <h1 className="text-center text-2xl font-bold">{nomProjet}</h1>
            </div>

            {elevesNonPlaces.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
                ⚠️ <strong>{elevesNonPlaces.length} élève(s) non placé(s)</strong> sur le plan.
              </div>
            )}

            <div className="mb-3 hidden text-center print:block">
              <h1 className="text-xl font-bold">{nomProjet}</h1>
              <p className="mt-1 text-xs text-gray-500">Plan de classe</p>
            </div>

            <div
              style={{ minHeight: hauteurPlanPixels + "px" }}
              className={
                "zone-plan-impression relative overflow-hidden rounded-xl border bg-gray-50 print:bg-white " +
                (vueExport === "professeur" ? "impression-vue-professeur" : "")
              }
            >
              <div className="tableau-plan-impression absolute left-[8%] right-[8%] top-3 z-10 rounded-md border border-gray-300 bg-white py-2 text-center text-xs font-semibold text-gray-700 shadow-sm">
                TABLEAU
              </div>
              {places.map(function (place) {
                const eleve = obtenirEleve(place.eleveId);

                const selectionneSeparation = Boolean(
                  eleve && selectionSeparation.includes(eleve.id),
                );

                const selectionneGroupement = Boolean(
                  eleve && selectionGroupement.includes(eleve.id),
                );

                return (
                  <div
                    key={place.id}
                    draggable={
                      Boolean(eleve) &&
                      !modeSelectionSeparation &&
                      !modeSelectionGroupement &&
                      !place.verrouillee
                    }
                    onClick={function () {
                      if (modeSelectionSeparation && eleve) {
                        basculerSelectionSeparation(eleve.id);
                        return;
                      }

                      if (modeSelectionGroupement && eleve) {
                        basculerSelectionGroupement(eleve.id);
                      }
                    }}
                    onDragStart={function () {
                      commencerGlisser(place);
                    }}
                    onDragOver={function (event) {
                      event.preventDefault();
                    }}
                    onDrop={function () {
                      deposerSurPlace(place.id);
                    }}
                    style={
                      {
                        left: positionXPourPlan(place.x) + "%",
                        top: 12 + place.y * 0.84 + "%",
                        ["--position-x" as any]:
                          positionXPourPlan(place.x) + "%",
                        ["--position-x-export" as any]:
                          positionXPourExport(place.x) + "%",
                        ["--position-y" as any]: 12 + place.y * 0.84 + "%",
                      } as React.CSSProperties
                    }
                    className={
                      "place-plan-impression absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-md border px-1 text-center text-xs font-semibold shadow-sm " +
                      (grilleSuiviActive ? "h-20 " : "h-16 ") +
                      (selectionneSeparation
                        ? "border-red-600 bg-red-100"
                        : selectionneGroupement
                          ? "border-emerald-600 bg-emerald-100"
                        : place.verrouillee
                          ? "border-amber-400 bg-amber-50"
                          : eleve
                            ? "border-gray-300 bg-white text-gray-800"
                            : "border-gray-200 bg-white text-gray-300")
                    }
                  >
                    <span
                      className={
                        eleve
                          ? "max-w-full leading-tight " +
                            (nomCourt(eleve, eleves).length >= 19
                              ? "text-[9px]"
                              : nomCourt(eleve, eleves).length >= 15
                                ? "text-[10px]"
                                : "text-xs")
                          : "print:hidden"
                      }
                    >
                      {eleve ? nomCourt(eleve, eleves) : "Libre"}
                    </span>

                    {eleve && grilleSuiviActive && (
                      <div
                        className="mt-1 grid justify-center gap-[2px]"
                        style={{
                          gridTemplateColumns: `repeat(${Math.ceil(
                            nombreCasesSuivi / 2,
                          )}, 12px)`,
                        }}
                        aria-label={`Grille de suivi de ${nomCourt(eleve, eleves)}`}
                      >
                        {Array.from(
                          { length: nombreCasesSuivi },
                          function (_, index) {
                            return (
                              <span
                                key={index}
                                className="block h-3 w-3 border border-gray-400 bg-white print:border-black"
                              />
                            );
                          },
                        )}
                      </div>
                    )}

                    {eleve &&
                      !modeSelectionSeparation &&
                      !modeSelectionGroupement && (
                      <div className={(grilleSuiviActive ? "mt-0.5 " : "mt-1 ") + "flex items-center gap-1 print:hidden"}>
                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={function (event) {
                            event.stopPropagation();
                          }}
                          onClick={function (event) {
                            event.stopPropagation();

                            basculerVerrouillage(place.id);
                          }}
                          className="rounded px-1 hover:bg-gray-100"
                          title={
                            place.verrouillee
                              ? "Déverrouiller cette place"
                              : "Fixer cet élève à cette place"
                          }
                        >
                          {place.verrouillee ? "🔒" : "📌"}
                        </button>

                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={function (event) {
                            event.stopPropagation();
                          }}
                          onClick={function (event) {
                            event.stopPropagation();

                            demanderSuppressionEleve(eleve);
                          }}
                          className="rounded px-1 text-red-400 opacity-60 transition hover:bg-red-50 hover:text-red-600 hover:opacity-100"
                          title="Supprimer cet élève de la classe"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-4 border-t pt-3 text-xs text-gray-500 print:hidden">
              {binomesMixtesActifs && (
                <span className={scoreBinomes.mixtes >= scoreBinomes.possibles ? "text-emerald-700" : "text-amber-700"}>
                  {scoreBinomes.mixtes >= scoreBinomes.possibles ? "✓" : "⚠️"} Binômes mixtes :{" "}
                  <strong>
                    {scoreBinomes.mixtes}/{scoreBinomes.possibles}
                  </strong>
                </span>
              )}

              <span>
                {contraintesEnErreur.length === 0
                  ? "✓ Séparations"
                  : `⚠️ ${contraintesEnErreur.length} séparation(s)`}
              </span>

              <span>
                {groupesEnErreur.length === 0
                  ? "✓ Groupements"
                  : `⚠️ ${groupesEnErreur.length} groupement(s)`}
              </span>

              <span>
                {devantEnErreur.length === 0
                  ? "✓ Devant"
                  : `⚠️ ${devantEnErreur.length} placement(s)`}
              </span>

              <span>
                {elevesNonPlaces.length === 0
                  ? "✓ Tous placés"
                  : `⚠️ ${elevesNonPlaces.length} non placé(s)`}
              </span>

              <span>🔒 {nombreVerrouilles}</span>
            </div>

            {nombreVerrouilles > 0 && (
              <button
                onClick={toutDeverrouiller}
                className="mt-3 w-full text-xs text-gray-500 underline print:hidden"
              >
                Tout déverrouiller
              </button>
            )}

            <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
              <h2 className="text-lg font-bold text-gray-900">📤 Export</h2>
              <p className="mt-1 text-xs text-gray-500">
                Prépare la grille papier puis choisis la vue du PDF.
              </p>

              <div className="mt-4 space-y-4">
                <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                  <h3 className="mb-3 font-bold">▦ Grille de suivi</h3>

              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={grilleSuiviActive}
                  onChange={function (event) {
                    setGrilleSuiviActive(event.target.checked);
                  }}
                  className="h-4 w-4"
                />
                Ajouter une grille sous chaque élève
              </label>

              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <span>Nombre de cases :</span>
                <select
                  value={nombreCasesSuivi}
                  disabled={!grilleSuiviActive}
                  onChange={function (event) {
                    setNombreCasesSuivi(Number(event.target.value));
                  }}
                  className="rounded-md border bg-white px-2 py-1 disabled:opacity-40"
                >
                  {[4, 6, 8, 10].map(function (valeur) {
                    return (
                      <option key={valeur} value={valeur}>
                        {valeur}
                      </option>
                    );
                  })}
                </select>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                La grille est volontairement vide : elle est prévue pour être cochée au stylo sur le plan imprimé. Par défaut, 8 cases sont affichées sur 2 lignes de 4.
              </p>
                </section>

                <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                  <h3 className="mb-3 font-bold">🖨️ Export PDF</h3>

              <label className="mb-1 block text-xs font-medium text-gray-500">
                Orientation du plan
              </label>

              <select
                value={vueExport}
                onChange={function (event) {
                  setVueExport(event.target.value as VueExport);
                }}
                className="mb-3 w-full rounded-lg border bg-white p-2.5 text-sm"
              >
                <option value="aerienne">Vue aérienne</option>
                <option value="professeur">Vue professeur</option>
              </select>

              <p className="mb-3 text-xs text-gray-500">
                Vue aérienne : tableau en haut. Vue professeur : tableau en bas, comme lorsque tu regardes la classe depuis le tableau. Le PDF sera en A4 paysage et affichera le nom de la classe.
              </p>

              <button
                onClick={imprimerPlan}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Exporter en PDF
              </button>
                </section>
              </div>
            </section>
          </section>

          {/* OUTILS À DROITE */}
          <aside className="space-y-5 lg:col-span-1 print:hidden">
            <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
              <h2 className="text-lg font-bold text-indigo-950">🎯 Placement</h2>
              <p className="mt-1 text-xs text-indigo-800/70">
                Choisis un placement simple, ou utilise le placement intelligent avec les règles ci-dessous.
              </p>

              <div className="mt-4 px-3">
                <button
                  onClick={ordreAlphabetiquePrenom}
                  disabled={modeSelectionSeparation || modeSelectionGroupement}
                  className="w-full rounded-lg bg-sky-600 p-3 font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="block">🔤 Placement alphabétique</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-sky-100">par prénom</span>
                </button>
              </div>

              <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-white p-3 shadow-sm">
                <button
                  onClick={melangerIntelligemment}
                  disabled={modeSelectionSeparation || modeSelectionGroupement}
                  className="w-full rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🧠 Placement intelligent
                </button>

                <p className="mt-3 text-xs font-semibold text-indigo-900">
                  Règles prises en compte par ce bouton :
                </p>

                <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-950">
                  <input
                    type="checkbox"
                    checked={binomesMixtesActifs}
                    onChange={function (event) {
                      setBinomesMixtesActifs(event.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 font-semibold">
                      <span>⚖️ Binômes mixtes</span>
                      {binomesMixtesActifs && (
                        <strong className={scoreBinomes.mixtes >= scoreBinomes.possibles ? "text-emerald-700" : "text-amber-700"}>
                          {scoreBinomes.mixtes >= scoreBinomes.possibles ? "✓ " : "⚠️ "}
                          {scoreBinomes.mixtes}/{scoreBinomes.possibles}
                        </strong>
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] font-normal text-indigo-800/70">
                      Cherche surtout à alterner filles et garçons sur les tables côte à côte, y compris sur les blocs de 3 ou 4 tables.
                    </span>
                  </span>
                </label>

                <div className="mt-3 space-y-3">
                  <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 text-xs">
                    <h3 className="mb-2 text-sm font-bold text-indigo-950">📍 Placer devant</h3>

              <select
                value={eleveAPlacerDevant ?? ""}
                onChange={function (event) {
                  setEleveAPlacerDevant(
                    event.target.value ? Number(event.target.value) : null,
                  );
                }}
                className="mb-2 w-full rounded border p-2"
              >
                <option value="">Choisir un élève</option>

                {eleves
                  .filter(function (eleve) {
                    return !elevesDevant.includes(eleve.id);
                  })
                  .map(function (eleve) {
                    return (
                      <option key={eleve.id} value={eleve.id}>
                        {eleve.prenom} {eleve.nom}
                      </option>
                    );
                  })}
              </select>

              <button
                onClick={ajouterEleveDevant}
                className="w-full rounded-lg bg-indigo-600 p-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Ajouter
              </button>

              <div className="mt-3 space-y-1">
                {elevesDevant.map(function (id) {
                  const eleve = obtenirEleve(id);

                  if (!eleve) {
                    return null;
                  }

                  return (
                    <div
                      key={id}
                      className={
                        "flex justify-between rounded p-2 text-sm " +
                        (devantEnErreur.includes(id)
                          ? "bg-amber-100 text-amber-900"
                          : "bg-gray-100")
                      }
                    >
                      <span>
                        {devantEnErreur.includes(id) ? "⚠️" : "✓"}{" "}
                        {eleve.prenom} {eleve.nom}
                      </span>

                      <button
                        onClick={function () {
                          basculerEleveDevant(id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
                  </section>

                  <section
                    className={
                      "rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 text-xs " +
                      (modeSelectionGroupement ? "ring-2 ring-emerald-300" : "")
                    }
                  >
              <div className="mb-3 flex justify-between gap-2">
                <h2 className="text-sm font-bold text-indigo-950">👥 Binôme / trinôme</h2>

                {!modeSelectionGroupement && !modeSelectionSeparation && (
                  <button
                    onClick={commencerModeGroupement}
                    className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800"
                  >
                    + Créer
                  </button>
                )}
              </div>

              {modeSelectionGroupement ? (
                <div className="rounded bg-emerald-50 p-3 text-sm">
                  <strong>Clique sur 2 ou 3 élèves dans le plan.</strong>

                  <div className="mt-2 rounded bg-white p-2">
                    {selectionGroupement.length === 0
                      ? "Aucun élève sélectionné"
                      : selectionGroupement
                          .map(function (id) {
                            return obtenirEleve(id)?.prenom ?? "";
                          })
                          .join(" + ")}
                  </div>

                  {selectionGroupement.length >= 2 && (
                    <button
                      onClick={creerGroupementSelectionne}
                      className="mt-2 w-full rounded bg-emerald-600 p-2 font-semibold text-white"
                    >
                      Créer ce {selectionGroupement.length === 2 ? "binôme" : "trinôme"}
                    </button>
                  )}

                  <button
                    onClick={annulerModeGroupement}
                    className="mt-2 w-full rounded bg-gray-200 p-2"
                  >
                    Annuler
                  </button>

                  <p className="mt-2 text-xs text-emerald-900">
                    💡 Une fois le groupe créé, appuie sur <strong>« Placement intelligent »</strong>
                    pour chercher un plan qui respecte cette règle.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupesProximite.length === 0 && (
                    <p className="text-sm text-gray-400">Aucun groupement.</p>
                  )}

                  {groupesProximite.map(function (groupe) {
                    const erreur = groupesEnErreur.some(function (item) {
                      return item.id === groupe.id;
                    });

                    return (
                      <div
                        key={groupe.id}
                        className={
                          "flex items-center justify-between gap-2 rounded p-2 text-sm " +
                          (erreur
                            ? "bg-amber-100 text-amber-950"
                            : "bg-emerald-50 text-emerald-900")
                        }
                      >
                        <span>
                          {erreur ? "⚠️ " : ""}
                          {groupe.eleveIds
                            .map(function (id) {
                              return obtenirEleve(id)?.prenom ?? "";
                            })
                            .join(" / ")}
                        </span>

                        <button
                          onClick={function () {
                            supprimerGroupeProximite(groupe.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-900">
                    💡 Appuie ensuite sur <strong>« Placement intelligent »</strong>
                    pour constituer un plan qui cherche à respecter cette règle.
                  </p>
                </div>
              )}
                  </section>

                  <section
                    className={
                      "rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 text-xs " +
                      (modeSelectionSeparation ? "ring-2 ring-red-300" : "")
                    }
                  >
              <div className="mb-3 flex justify-between gap-2">
                <h2 className="text-sm font-bold text-indigo-950">🚫 Séparations</h2>

                {!modeSelectionSeparation && !modeSelectionGroupement && (
                  <button
                    onClick={commencerModeSeparation}
                    className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800"
                  >
                    + Créer
                  </button>
                )}
              </div>

              {modeSelectionSeparation ? (
                <div className="rounded bg-red-50 p-3 text-sm">
                  <strong>Clique sur deux élèves dans le plan.</strong>

                  <div className="mt-2 rounded bg-white p-2">
                    {selectionSeparation.length === 0
                      ? "Aucun élève sélectionné"
                      : selectionSeparation
                          .map(function (id) {
                            return obtenirEleve(id)?.prenom ?? "";
                          })
                          .join(" + ")}
                  </div>

                  {selectionSeparation.length === 2 && (
                    <button
                      onClick={creerSeparationSelectionnee}
                      className="mt-2 w-full rounded bg-red-600 p-2 font-semibold text-white"
                    >
                      Confirmer
                    </button>
                  )}

                  <button
                    onClick={annulerModeSeparation}
                    className="mt-2 w-full rounded bg-gray-200 p-2"
                  >
                    Annuler
                  </button>

                  <p className="mt-2 text-xs text-red-900">
                    💡 Une fois la séparation créée, appuie sur <strong>« Placement intelligent »</strong>
                    pour chercher un plan qui respecte cette règle.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contraintes.length === 0 && (
                    <p className="text-sm text-gray-400">Aucune séparation.</p>
                  )}

                  {contraintes.map(function (contrainte) {
                    const eleve1 = obtenirEleve(contrainte.eleve1Id);

                    const eleve2 = obtenirEleve(contrainte.eleve2Id);

                    const erreur = contraintesEnErreur.some(function (item) {
                      return item.id === contrainte.id;
                    });

                    return (
                      <div
                        key={contrainte.id}
                        className={
                          "flex justify-between rounded p-2 text-sm " +
                          (erreur ? "bg-red-100 text-red-900" : "bg-gray-100")
                        }
                      >
                        <span>
                          {erreur ? "⚠️ " : ""}
                          {eleve1?.prenom} / {eleve2?.prenom}
                        </span>

                        <button
                          onClick={function () {
                            supprimerContrainte(contrainte.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <p className="rounded bg-red-50 p-2 text-xs text-red-900">
                    💡 Appuie ensuite sur <strong>« Placement intelligent »</strong>
                    pour constituer un plan qui cherche à respecter cette règle.
                  </p>
                </div>
              )}
                  </section>
                </div>
              </div>
            </section>

          </aside>
        </div>
      )}
    </main>
  );
}
