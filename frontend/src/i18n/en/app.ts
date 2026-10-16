// Navigation, shared words, hold colours and error messages.

const app = {
  nav: {
    main: 'Main',
    logCruxes: 'Log Cruxes',
    myGym: 'My Gym',
    board: 'Board',
    training: 'Training',
    setting: 'Crux setting',
    coach: 'How should I work on this crux?',
    logout: 'Log out',
    language: 'Language',
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
  },
  footer: {
    tagline: 'Your climbing logbook.',
  },
  common: {
    loading: 'Loading…',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    notSet: 'Not set',
  },
  colours: {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    mint: 'Mint',
    blue: 'Blue',
    purple: 'Purple',
    pink: 'Pink',
    black: 'Black',
    white: 'White',
    grey: 'Grey',
    brown: 'Brown',
  },
  errors: {
    username_taken: 'That username is already taken.',
    invalid_credentials: 'Wrong username or password.',
    not_a_video: 'That file isn’t a video.',
    video_too_large: 'That video is too large (max {{max}} MB).',
    crux_not_found: 'This crux doesn’t exist.',
    invalid_input: 'Some fields aren’t valid. Check them and try again.',
    network: 'Can’t reach the server. Is it running?',
    gym_map_unavailable: 'The gym map couldn’t be loaded from TopLogger. Try again later.',
    board_crux_not_found: 'This board crux doesn’t exist or is private.',
    not_your_crux: 'Only the setter can change this crux.',
    session_not_found: 'This session doesn’t exist.',
    template_not_found: 'This template doesn’t exist or is private.',
    unknown: 'Something went wrong. Try again.',
  },
}

export default app
