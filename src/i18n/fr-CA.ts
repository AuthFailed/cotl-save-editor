import type { Dict } from './en'
import fr from './fr'

// Canadian French: the French text, with the words Quebec uses differently.
const frCA: Dict = {
  ...fr,
  'top.changes': { one: '{n} changement', other: '{n} changements' },
  'open.discard': { one: 'Abandonner {n} changement non exporté?', other: 'Abandonner {n} changements non exportés?' },
  'common.nothingFor': 'Aucun résultat pour « {q} ».',
  'prefs.theme': 'Thème : {theme}',
  'insp.deleteConfirm': 'Supprimer la fiche de {name} et le retirer de chaque maison, poste et liste d’adeptes? Le jeu ne fait jamais cela; Renvoyer ou Tuer laisse la sauvegarde telle que le jeu la laisserait. Vous pourrez l’annuler jusqu’à l’exportation.',
  'export.betaConfirm': '{file} est dans un format qui n’a encore été testé sur aucune vraie sauvegarde. Exporter quand même? Gardez la copie de secours.',
  'rev.title': 'Vérifier les changements',
  'rev.none': 'Aucun changement pour l’instant. Vos changements apparaîtront ici, chacun annulable jusqu’à l’exportation.',
  'raw.hint': 'Toutes les valeurs de la sauvegarde. Les changements faits ici rejoignent la même liste que les autres et s’annulent de la même façon.',
  'file.failed': 'Impossible de lire ou d’écrire {file}. Vos changements sont toujours là; choisissez à nouveau le dossier, ou signalez-le si cela se reproduit.',
  'export.changed': '{file} a changé sur le disque après son ouverture : le jeu, la synchronisation infonuagique ou un fichier que vous avez remis en place l’a écrit. Exporter maintenant remplacerait ce fichier plus récent.',
  'open.changedKept': { one: '{file} a changé sur le disque depuis son ouverture. Son {n} changement non exporté est conservé, sur la copie ouverte.', other: '{file} a changé sur le disque depuis son ouverture. Ses {n} changements non exportés sont conservés, sur la copie ouverte.' },
}

export default frCA
