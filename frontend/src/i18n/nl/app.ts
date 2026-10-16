import type appEn from '../en/app'

const app: typeof appEn = {
  nav: {
    main: 'Hoofdmenu',
    logCruxes: 'Cruxen loggen',
    myGym: 'Mijn hal',
    board: 'Board',
    training: 'Training',
    coach: 'Hoe pak ik deze crux aan?',
    logout: 'Uitloggen',
    language: 'Taal',
    toLight: 'Naar lichte modus',
    toDark: 'Naar donkere modus',
  },
  footer: {
    tagline: 'Jouw klimlogboek.',
  },
  common: {
    loading: 'Laden…',
    cancel: 'Annuleren',
    save: 'Opslaan',
    saving: 'Opslaan…',
    notSet: 'Niet ingevuld',
  },
  colours: {
    red: 'Rood',
    orange: 'Oranje',
    yellow: 'Geel',
    green: 'Groen',
    mint: 'Mint',
    blue: 'Blauw',
    purple: 'Paars',
    pink: 'Roze',
    black: 'Zwart',
    white: 'Wit',
    grey: 'Grijs',
    brown: 'Bruin',
  },
  errors: {
    username_taken: 'Die gebruikersnaam is al bezet.',
    invalid_credentials: 'Verkeerde gebruikersnaam of wachtwoord.',
    not_a_video: 'Dat bestand is geen video.',
    video_too_large: 'Die video is te groot (max. {{max}} MB).',
    crux_not_found: 'Deze crux bestaat niet.',
    invalid_input: 'Sommige velden zijn ongeldig. Controleer ze en probeer het opnieuw.',
    network: 'De server is niet bereikbaar. Draait hij wel?',
    gym_map_unavailable: 'De plattegrond kon niet van TopLogger geladen worden. Probeer het later opnieuw.',
    board_crux_not_found: 'Deze boardcrux bestaat niet of is privé.',
    not_your_crux: 'Alleen de bouwer kan deze crux wijzigen.',
    session_not_found: 'Deze sessie bestaat niet.',
    unknown: 'Er ging iets mis. Probeer het opnieuw.',
  },
}

export default app
