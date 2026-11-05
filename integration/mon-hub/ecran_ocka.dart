// Le module OCKA : le studio de musique gratuit et open source de Romain.
// OCKA est une appli web (elle tourne dans Chrome, qui sait enregistrer le micro et fabriquer le son) :
// ce module la présente et l'ouvre dans un onglet Chrome intégré à l'appli.
// Il ne garde aucune donnée : les morceaux restent dans OCKA, sur le téléphone.
// À copier dans lib/modules/ocka/ecran_ocka.dart (voir LISEZ-MOI.md).
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../theme.dart';

/// Adresse d'OCKA publiée sur GitHub Pages (organisation arko-video, comme Arko).
const String adresseOcka = 'https://arko-video.github.io/ocka/';

/// La teinte d'OCKA (le violet de son thème), reprise dans lib/noyau/design.dart.
const Color teinteOcka = Color(0xFFA855F7);

class EcranOcka extends StatelessWidget {
  const EcranOcka({super.key});

  Future<void> _ouvrir(BuildContext context) async {
    var ouvert = false;
    try {
      ouvert = await launchUrl(Uri.parse(adresseOcka), mode: LaunchMode.inAppBrowserView);
    } catch (_) {
      ouvert = false;
    }
    if (!ouvert && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Impossible d'ouvrir OCKA. Vérifie ta connexion internet.")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OCKA', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 4, 4, 14),
                child: Text(
                  'Fais tes beats, pose ta voix, sors tes morceaux sur Spotify',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 0, 4, 20),
                child: Text(
                  'Choisis un style, change le beat et la mélodie, enregistre ta voix avec des effets, '
                  'puis prépare le dossier complet pour Spotify : son, pochette, paroles et fiche à recopier. '
                  'Tes morceaux et ta voix restent sur ton téléphone.',
                  style: TextStyle(fontSize: 15, color: Couleurs.texteSecondaire),
                ),
              ),
              FilledButton.icon(
                onPressed: () => _ouvrir(context),
                style: FilledButton.styleFrom(backgroundColor: teinteOcka, foregroundColor: Colors.white),
                icon: const Icon(Icons.graphic_eq),
                label: const Text('Ouvrir OCKA'),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 16, 4, 0),
                child: Text(
                  'Astuce : dans OCKA, touche le menu ⋮ de Chrome puis « Ajouter à l’écran d’accueil » '
                  'pour l’avoir aussi comme une vraie appli. Pour chanter, branche un casque filaire.',
                  style: TextStyle(fontSize: 13, color: Couleurs.texteSecondaire),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
