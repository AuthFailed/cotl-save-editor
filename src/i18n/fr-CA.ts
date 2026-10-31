import type { Dict } from './en'
import fr from './fr'

// Canadian French: the French text, with the words Quebec uses differently.
const frCA: Dict = {
  ...fr,
  'top.changes': { one: '{n} changement', other: '{n} changements' },
  'open.discard': { one: 'Abandonner {n} changement non exporté?', other: 'Abandonner {n} changements non exportés?' },
  'common.nothingFor': 'Aucun résultat pour « {q} ».',
  'prefs.theme': 'Thème : {theme}',
  'insp.removeConfirm': 'Retirer {name} du culte? Vous pourrez l’annuler jusqu’à l’exportation.',
  'export.betaConfirm': '{file} est dans un format qui n’a encore été testé sur aucune vraie sauvegarde. Exporter quand même? Gardez la copie de secours.',
  'rev.title': 'Vérifier les changements',
  'rev.none': 'Aucun changement pour l’instant. Vos changements apparaîtront ici, chacun annulable jusqu’à l’exportation.',
  'raw.hint': 'Toutes les valeurs de la sauvegarde. Les changements faits ici rejoignent la même liste que les autres et s’annulent de la même façon.',
}

export default frCA
