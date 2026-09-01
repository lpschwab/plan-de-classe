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

const POINTS_X = Array.from({ length: 43 }, (_, index) => 8 + index * 2);

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

      // Les binômes mixtes correspondent à des tables réellement côte à côte
      // sur une même rangée. On exclut donc les voisinages verticaux : auparavant,
      // certaines dispositions pouvaient considérer deux élèves l'un derrière
      // l'autre comme un binôme.
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
    return a.distance - b.distance;
  });

  const utilisees = new Set<number>();

  const binomes: Place[][] = [];

  candidats.forEach(function (candidat) {
    if (
      utilisees.has(candidat.place1.id) ||
      utilisees.has(candidat.place2.id)
    ) {
      return;
    }

    utilisees.add(candidat.place1.id);

    utilisees.add(candidat.place2.id);

    binomes.push([candidat.place1, candidat.place2]);
  });

  return binomes;
}

function calculerScoreBinomes(eleves: Eleve[], places: Place[]): ScoreBinomes {
  const elevesParId = new Map<number, Eleve>();

  eleves.forEach(function (eleve) {
    elevesParId.set(eleve.id, eleve);
  });

  const binomes = trouverBinomes(places);

  let mixtes = 0;

  binomes.forEach(function (binome) {
    const eleve1 =
      binome[0].eleveId === null
        ? null
        : (elevesParId.get(binome[0].eleveId) ?? null);

    const eleve2 =
      binome[1].eleveId === null
        ? null
        : (elevesParId.get(binome[1].eleveId) ?? null);

    if (!eleve1 || !eleve2) {
      return;
    }

    if (
      (estFille(eleve1) && estGarcon(eleve2)) ||
      (estGarcon(eleve1) && estFille(eleve2))
    ) {
      mixtes++;
    }
  });

  // L'objectif doit refléter le plan réellement occupé, pas toutes les
  // tables disponibles dans la salle. Sinon l'indicateur pouvait annoncer
  // artificiellement qu'il manquait des binômes mixtes à cause de places vides.
  const elevesPlaces = new Set<number>();
  let binomesOccupes = 0;

  binomes.forEach(function (binome) {
    if (binome[0].eleveId !== null) {
      elevesPlaces.add(binome[0].eleveId);
    }

    if (binome[1].eleveId !== null) {
      elevesPlaces.add(binome[1].eleveId);
    }

    if (binome[0].eleveId !== null && binome[1].eleveId !== null) {
      binomesOccupes++;
    }
  });

  const elevesEffectivementPlaces = eleves.filter(function (eleve) {
    return elevesPlaces.has(eleve.id);
  });

  const possibles = Math.min(
    elevesEffectivementPlaces.filter(estFille).length,
    elevesEffectivementPlaces.filter(estGarcon).length,
    binomesOccupes,
  );

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

  // Pour préserver de vrais binômes côte à côte, on sélectionne d'abord les
  // places par paires complètes, de l'avant vers le fond. Cela évite par exemple
  // de prendre deux demi-binômes au centre d'une rangée lorsqu'il ne reste que
  // deux élèves à placer.
  const binomes = trouverBinomes(places).sort(function (a, b) {
    const yA = (a[0].y + a[1].y) / 2;
    const yB = (b[0].y + b[1].y) / 2;

    if (Math.abs(yA - yB) > 0.5) {
      return yA - yB;
    }

    const centreA = (a[0].x + a[1].x) / 2;
    const centreB = (b[0].x + b[1].x) / 2;

    return Math.abs(centreA - 50) - Math.abs(centreB - 50);
  });

  binomes.forEach(function (binome) {
    if (idsActifs.size >= nombreAPlacer) {
      return;
    }

    const aAjouter = binome.filter(function (place) {
      return !idsActifs.has(place.id);
    });

    const placesRestantes = nombreAPlacer - idsActifs.size;

    if (aAjouter.length <= placesRestantes) {
      aAjouter.forEach(function (place) {
        idsActifs.add(place.id);
      });
    }
  });

  // S'il reste un nombre impair d'élèves, ou une place verrouillée isolée,
  // on complète ensuite avec les meilleures places individuelles.
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

function genererPlanMixte(eleves: Eleve[], places: Place[]): Place[] {
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

  function retirerAleatoire(): Eleve | null {
    const tous = [...filles, ...garcons, ...autres];

    if (tous.length === 0) {
      return null;
    }

    const choisi = tous[Math.floor(Math.random() * tous.length)];

    for (const liste of [filles, garcons, autres]) {
      const index = liste.findIndex(function (item) {
        return item.id === choisi.id;
      });

      if (index >= 0) {
        liste.splice(index, 1);
        break;
      }
    }

    return choisi;
  }

  function retirerCompatible(eleveFixe: Eleve | null): Eleve | null {
    if (eleveFixe && estFille(eleveFixe) && garcons.length > 0) {
      return garcons.shift() ?? null;
    }

    if (eleveFixe && estGarcon(eleveFixe) && filles.length > 0) {
      return filles.shift() ?? null;
    }

    return retirerAleatoire();
  }

  const binomes = melangerTableau(
    trouverBinomes(
      nouvellesPlaces.filter(function (place) {
        return placesActives.has(place.id);
      }),
    ),
  );

  binomes.forEach(function (binome) {
    const place1 = binome[0];
    const place2 = binome[1];

    const fixe1 = place1.verrouillee && place1.eleveId !== null;

    const fixe2 = place2.verrouillee && place2.eleveId !== null;

    if (fixe1 && fixe2) {
      return;
    }

    if (fixe1) {
      const fixe = elevesParId.get(place1.eleveId!) ?? null;

      const choisi = retirerCompatible(fixe);

      if (choisi) {
        place2.eleveId = choisi.id;
      }

      return;
    }

    if (fixe2) {
      const fixe = elevesParId.get(place2.eleveId!) ?? null;

      const choisi = retirerCompatible(fixe);

      if (choisi) {
        place1.eleveId = choisi.id;
      }

      return;
    }

    if (filles.length > 0 && garcons.length > 0) {
      const fille = filles.shift();

      const garcon = garcons.shift();

      if (!fille || !garcon) {
        return;
      }

      if (Math.random() < 0.5) {
        place1.eleveId = fille.id;

        place2.eleveId = garcon.id;
      } else {
        place1.eleveId = garcon.id;

        place2.eleveId = fille.id;
      }
    }
  });

  const restants = melangerTableau([...filles, ...garcons, ...autres]);

  const placesRestantes = nouvellesPlaces
    .filter(function (place) {
      return placesActives.has(place.id) && place.eleveId === null;
    })
    .sort(function (a, b) {
      if (Math.abs(a.y - b.y) > 0.5) {
        return a.y - b.y;
      }

      return Math.random() - 0.5;
    });

  placesRestantes.forEach(function (place, index) {
    const eleve = restants[index];

    if (eleve) {
      place.eleveId = eleve.id;
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
): EvaluationPlan {
  return {
    violationsSeparation: contraintesNonRespectees(contraintes, places).length,

    violationsGroupement: groupesProximiteNonRespectes(
      groupesProximite,
      places,
    ).length,

    violationsDevant: elevesDevantNonRespectes(elevesDevant, places).length,

    mixtes: calculerScoreBinomes(eleves, places).mixtes,
  };
}

function genererMeilleurPlan(
  eleves: Eleve[],
  places: Place[],
  contraintes: ContrainteSeparation[],
  groupesProximite: GroupeProximite[],
  elevesDevant: number[],
): Place[] {
  let meilleurPlan = genererPlanMixte(eleves, places);

  let meilleureEvaluation = evaluerPlan(
    eleves,
    meilleurPlan,
    contraintes,
    groupesProximite,
    elevesDevant,
  );

  for (let essai = 1; essai < 1400; essai++) {
    const candidat = genererPlanMixte(eleves, places);

    const evaluation = evaluerPlan(
      eleves,
      candidat,
      contraintes,
      groupesProximite,
      elevesDevant,
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
      meilleureEvaluation.mixtes >= calculerScoreBinomes(eleves, places).possibles
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

    return {
      idsSelectionnes,
      decalageX,
      decalageY,
      repereX,
      repereY,
    };
  }

  function mettreAJourReperesAlignement(clientX: number, clientY: number) {
    if (modeSalle !== "libre" || tableDeplaceeId === null) {
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
        Math.abs(cible.x - autre.x) < 7.5 &&
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-blue-950">
              👩‍🎓 Modifier les élèves
            </h2>

            <button
              onClick={ajouterEleve}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              ➕ Ajouter
            </button>
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

          <label className="mt-4 block cursor-pointer rounded-lg bg-blue-600 p-2 text-center text-sm font-semibold text-white">
            📂 Importer / remplacer par un CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={importerCSV}
              className="hidden"
            />
          </label>

          <p className="mt-2 text-xs text-gray-500">
            Compatible avec un CSV classique (Prénom, Nom, Sexe) et avec les exports
            enseignants contenant une colonne « Élèves » au format NOM Prénom. Les
            autres informations du fichier (date de naissance, e-mail, options, etc.)
            sont ignorées.
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
                    <span className={eleve ? "" : "print:hidden"}>
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
              <span className={scoreBinomes.mixtes >= scoreBinomes.possibles ? "text-emerald-700" : "text-amber-700"}>
                {scoreBinomes.mixtes >= scoreBinomes.possibles ? "✓" : "⚠️"} Binômes mixtes :{" "}
                <strong>
                  {scoreBinomes.mixtes}/{scoreBinomes.possibles}
                </strong>
              </span>

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
          </section>

          {/* OUTILS À DROITE */}
          <aside className="space-y-5 lg:col-span-1 print:hidden">
            <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
              <h2 className="text-lg font-bold text-indigo-950">🎯 Placement</h2>
              <p className="mt-1 text-xs text-indigo-800/70">
                Choisis un placement simple, ou utilise le placement intelligent avec les règles ci-dessous.
              </p>

              <button
                onClick={ordreAlphabetiquePrenom}
                disabled={modeSelectionSeparation || modeSelectionGroupement}
                className="mt-4 w-full rounded-lg border border-gray-300 bg-white p-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🔤 Ordre alphabétique (prénom)
              </button>

              <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-white p-3 shadow-sm">
                <button
                  onClick={melangerIntelligemment}
                  disabled={modeSelectionSeparation || modeSelectionGroupement}
                  className="w-full rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🧠 Placement intelligent
                </button>

                <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
                  <div className="flex items-center justify-between gap-2">
                    <span>⚖️ Binômes mixtes</span>
                    <strong className={scoreBinomes.mixtes >= scoreBinomes.possibles ? "text-emerald-700" : "text-amber-700"}>
                      {scoreBinomes.mixtes >= scoreBinomes.possibles ? "✓ " : "⚠️ "}
                      {scoreBinomes.mixtes}/{scoreBinomes.possibles}
                    </strong>
                  </div>
                  <p className="mt-1 text-[11px] text-indigo-800/70">
                    Le placement intelligent cherche à obtenir le maximum de binômes fille/garçon parmi les tables côte à côte.
                  </p>
                </div>

                <p className="mt-3 text-xs font-semibold text-indigo-900">
                  Règles prises en compte par ce bouton :
                </p>

                <div className="mt-3 space-y-3">
                  <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <h3 className="mb-2 font-bold text-amber-950">📍 Placer devant</h3>

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
                className="w-full rounded-lg bg-amber-500 p-2 font-semibold text-white"
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
                      "rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 " +
                      (modeSelectionGroupement ? "ring-2 ring-emerald-300" : "")
                    }
                  >
              <div className="mb-3 flex justify-between gap-2">
                <h2 className="font-bold">👥 Binôme / trinôme</h2>

                {!modeSelectionGroupement && !modeSelectionSeparation && (
                  <button
                    onClick={commencerModeGroupement}
                    className="rounded bg-emerald-100 px-2 py-1 text-sm font-semibold text-emerald-800"
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
                      "rounded-lg border border-red-200 bg-red-50/60 p-3 " +
                      (modeSelectionSeparation ? "ring-2 ring-red-300" : "")
                    }
                  >
              <div className="mb-3 flex justify-between gap-2">
                <h2 className="font-bold">🚫 Séparations</h2>

                {!modeSelectionSeparation && !modeSelectionGroupement && (
                  <button
                    onClick={commencerModeSeparation}
                    className="rounded bg-red-100 px-2 py-1 text-sm font-semibold text-red-800"
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

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow">
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
          </aside>
        </div>
      )}
    </main>
  );
}
