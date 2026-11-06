// Textes du moteur v2 (pistes instrument, échantillonneur). Propriétaire : M1.

export const TEXTES_MOTEUR = {
  moteur: {
    notesMuettes: (n: number) => `${n > 1 ? `${n} notes sont muettes` : 'Une note est muette'} : leur instrument n’est pas encore là.`,
    instrumentAbsent: 'Cet instrument n’est pas encore sur ton téléphone : télécharge-le pour l’entendre.',
  },
};
