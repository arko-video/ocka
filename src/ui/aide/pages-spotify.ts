// « Sortir sur Spotify » pas à pas, et la FAQ. Les règles viennent des décisions des phases 2 à 6 (§3), vérifiées
// en ligne le 4 novembre 2026 sur les pages officielles de liens.ts. On ne recopie pas les règles qui changent
// (âge, prix, délais exacts) : on renvoie vers la page officielle. Propriétaire : B3.

import type { PageAide } from './types';

export const PAGE_SPOTIFY: PageAide = {
  titre: 'Sortir sur Spotify',
  resume: 'OCKA prépare le dossier. Un distributeur l’envoie à Spotify.',
  blocs: [
    { t: 'p', texte: 'Spotify n’accepte pas la musique en direct : il faut passer par un distributeur. Tu crées ton compte chez lui, tu lui envoies le dossier d’OCKA, et il livre ton morceau à Spotify (et aux autres plateformes).' },
    { t: 'titre', texte: '1. Choisis ton distributeur' },
    { t: 'liste', items: [
      'RouteNote Free, pour commencer : gratuit (RouteNote garde une part de ce que tu gagnes). Le dossier sera en FLAC : RouteNote n’accepte pas le WAV.',
      'DistroKid : payant (abonnement). Le dossier sera en WAV 24 bits.',
    ] },
    { t: 'lien', texte: 'RouteNote : Free ou Premium ?', lien: 'routenoteFormules' },
    { t: 'lien', texte: 'RouteNote : les formats acceptés', lien: 'routenoteFormats' },
    { t: 'lien', texte: 'DistroKid : les formats acceptés', lien: 'distrokidFormats' },
    { t: 'titre', texte: '2. Crée ton compte toi-même' },
    { t: 'p', texte: 'Crée ton compte sur le site du distributeur, avec ton adresse e-mail. Avant, vérifie l’âge minimum sur sa page officielle : si tu es trop jeune, demande à un parent.' },
    { t: 'lien', texte: 'RouteNote : l’âge minimum', lien: 'routenoteAge' },
    { t: 'lien', texte: 'DistroKid : les conditions (dont l’âge)', lien: 'distrokidConditions' },
    { t: 'titre', texte: '3. Cherche ton nom d’artiste' },
    { t: 'p', texte: 'Cherche ton nom d’artiste sur Spotify AVANT d’envoyer. Si un autre artiste porte le même nom, ta musique pourrait arriver sur son profil. Si tu as déjà un profil, colle son lien dans l’assistant (« Lien de ton profil Spotify »).' },
    { t: 'titre', texte: '4. Prépare et envoie le dossier' },
    { t: 'liste', numerotee: true, items: [
      'Exporter → « Sortir sur Spotify » → Infos, Pochette, Vérifier → « Préparer le dossier ».',
      'Télécharge le dossier (.zip) et dézippe-le.',
      'Ouvre « fiche-de-sortie.html » : elle te dit quoi recopier chez ton distributeur, étape par étape.',
      'Envoie les fichiers audio, « pochette.jpg », puis recopie les infos de chaque titre.',
    ] },
    { t: 'titre', texte: '5. Choisis bien la date' },
    { t: 'p', texte: 'OCKA propose une date dans 6 semaines. Chez RouteNote, compte environ 3 à 5 semaines (21 à 23 jours ouvrés de vérification, puis la livraison) avant que ta sortie arrive sur les plateformes.' },
    { t: 'lien', texte: 'RouteNote : le délai du moment', lien: 'routenoteDelais' },
    { t: 'titre', texte: '6. Propose ton titre aux playlists' },
    { t: 'p', texte: 'Quand la sortie est livrée, connecte-toi à Spotify for Artists et propose ton titre aux playlists (le « pitch ») au moins 7 jours avant la date de sortie. Il arrivera aussi dans le « Release Radar » de tes abonnés.' },
    { t: 'lien', texte: 'Spotify for Artists : avoir accès à ton profil', lien: 'spotifyAcces' },
    { t: 'lien', texte: 'Spotify for Artists : proposer un titre', lien: 'spotifyPitch' },
    { t: 'titre', texte: '7. Déclare l’aide de l’IA' },
    { t: 'p', texte: 'Pour chaque titre, dis si une IA a servi pour les paroles, la musique ou la voix. OCKA le pré-remplit. Les styles et le hasard d’OCKA ne sont pas de l’IA. La déclaration se fait chez ton distributeur.' },
    { t: 'lien', texte: 'Spotify : l’IA dans les crédits', lien: 'spotifyIa' },
    { t: 'titre', texte: '8. Ajoute tes paroles' },
    { t: 'p', texte: 'Spotify affiche les paroles de Musixmatch. Quand ton titre est en ligne, crée un compte Musixmatch Pro, fais vérifier ton profil d’artiste, puis colle le fichier du dossier « paroles ».' },
    { t: 'lien', texte: 'Spotify : gérer tes paroles', lien: 'spotifyParoles' },
    { t: 'lien', texte: 'Musixmatch : ajouter tes paroles', lien: 'musixmatchParoles' },
    { t: 'voir', texte: 'Tes droits', page: 'droits' },
  ],
};

export const PAGE_FAQ: PageAide = {
  titre: 'Questions fréquentes',
  resume: 'Les réponses courtes aux questions qui reviennent.',
  blocs: [
    { t: 'question', q: 'M4A, WAV ou FLAC ?', r: 'M4A : léger, pour écouter et partager. WAV : la qualité studio, pour DistroKid ou pour finir ailleurs. FLAC : la même qualité que le WAV en plus léger ; c’est le format pour RouteNote, qui refuse le WAV.' },
    { t: 'question', q: 'Pourquoi −14 LUFS ?', r: 'Les LUFS mesurent le volume ressenti. Spotify ramène tous les titres vers −14 LUFS : un morceau plus fort est baissé. OCKA vise donc −14 LUFS, avec des crêtes sous −1 dB, pour que ton son garde son punch sans grésiller.' },
    { t: 'question', q: 'Je peux chanter avec un casque Bluetooth ?', r: 'Mieux vaut pas : le Bluetooth ajoute beaucoup de retard, et ta voix arrive après le beat. Branche un casque filaire, puis refais le calibrage.' },
    { t: 'question', q: 'La mémoire est pleine, que faire ?', r: 'Supprime de vieux morceaux ou des prises que tu n’as pas gardées, puis libère de la place sur le téléphone (photos, vidéos, applis). Un dossier de sortie demande environ deux fois sa taille de place libre.' },
    { t: 'question', q: 'Où sont rangés mes morceaux ?', r: 'Dans le stockage de Chrome, sur ton téléphone. Si tu effaces les données de Chrome, ou si tu changes de téléphone, ils disparaissent : garde une copie avec « Exporter le projet ».' },
    { t: 'question', q: 'Mes prises de voix partent sur internet ?', r: 'Non. Tout se fait sur ton appareil. Seule exception, si tu l’actives : l’IA, avec ta propre clé. Elle ne reçoit que ce que tu lui envoies d’un geste (jamais tes prises de voix).' },
    { t: 'question', q: 'Single, EP ou album ?', r: 'Règle de Spotify : 1 à 3 titres et moins de 30 minutes = single ; 4 à 6 titres et moins de 30 minutes = EP ; sinon, album. OCKA le calcule pour toi.' },
    { t: 'question', q: 'Combien de temps doit durer un titre ?', r: 'Au moins 30 secondes : c’est le temps à partir duquel une écoute compte. Ajoute une section dans Structure si ton morceau est trop court.' },
    { t: 'question', q: 'Mon morceau a été refusé, pourquoi ?', r: 'Souvent : un extrait de chanson sans droits, une pochette avec un logo ou un lien, un titre en MAJUSCULES, ou ton pseudo à la place de ton vrai nom dans les crédits. Lis l’e-mail du distributeur, corrige dans OCKA et prépare un nouveau dossier.' },
    { t: 'lien', texte: 'Spotify : la sonie (−14 LUFS)', lien: 'spotifySonie' },
  ],
};
