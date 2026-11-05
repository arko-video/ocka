// Point d'entrée d'OCKA : polices, styles, navigation, sauvegarde automatique, puis l'interface.

import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
// Styles dans l'ordre de la cascade (un fichier par écran ou par famille de composants).
import './ui/styles/theme.css';
import './ui/styles/messages.css';
import './ui/styles/controles.css';
import './ui/styles/formulaires.css';
import './ui/styles/accueil.css';
import './ui/styles/studio.css';
import './ui/styles/beat.css';
import './ui/styles/melodie.css';
import './ui/styles/structure.css';
import './ui/styles/voix.css';
import './ui/styles/son.css';
import './ui/styles/sortie.css';
import './aller-vite/aller-vite.css';

import { render } from 'preact';
import { App } from './ui/App';
import { suivreExport } from './ui/exportation';
import { suivreMorceau } from './ui/lecture';
import { initialiserNavigation } from './ui/navigation';
import { activerSauvegardeAuto } from './ui/sauvegarde';

initialiserNavigation();
activerSauvegardeAuto();
suivreMorceau();
suivreExport();

const racine = document.getElementById('app');
if (racine) render(<App />, racine);
