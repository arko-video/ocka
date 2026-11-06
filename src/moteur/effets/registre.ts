// Registre des contextes HORS LIGNE pour les inserts JS (propriétaire : M2). Sans import : pas de boucle.
//  - passe A (« prise ») : contexte où les pistes listées s'arrêtent JUSTE avant leurs inserts JS (on rend
//    ce qui entre dans le compresseur / bitcrusher, sans envois) ;
//  - rendus : pour un contexte d'export, le son des pistes APRÈS leurs inserts JS (calculés en JS sur la passe A),
//    rejoué par un AudioBufferSourceNode à la place du worklet.

/** Son d'une piste après ses inserts JS : canaux `canal` et `canal + 1` de `tampon`, trame 0 = temps `debut` du morceau. */
export interface RenduJs {
  tampon: AudioBuffer;
  canal: number;
  debut: number;
}

export const prises = new WeakMap<BaseAudioContext, Set<string>>();
export const rendus = new WeakMap<BaseAudioContext, Map<string, RenduJs>>();
