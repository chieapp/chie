import crypto from 'node:crypto';

export const sydneyWebSocketUrl = 'wss://sydney.bing.com/sydney/ChatHub';

// Arguments used for sending messages.
export const chatArgument = {
  source: 'cib',
  optionsSets: [
    'harmonyv3',  // tone
    'nlu_direct_response_filter',
    'deepleo',
    'disable_emoji_spoken_text',
    'responsible_ai_policy_235',
    'enablemm',
    'dtappid',
    'cricinfo',
    'cricinfov2',
    'dv3sugg',
  ],
  allowedMessageTypes: [
    'Chat',
    'InternalSearchQuery',
    'InternalSearchResult',
    'Disengaged',
    'InternalLoaderMessage',
    'RenderCardRequest',
    'AdsQuery',
    'SemanticSerp',
    'GenerateContentQuery',
    'SearchQuery',
  ],
  sliceIds: [],
};

// Headers used for initializing the conversation.
export const edgeBrowserHeaders = {
  'accept': 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/json',
  'sec-ch-ua': '"Chromium";v="112", "Microsoft Edge";v="112", "Not:A-Brand";v="99"',
  'sec-ch-ua-arch': '"x86"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version': '"112.0.1722.7"',
  'sec-ch-ua-full-version-list': '"Chromium";v="112.0.5615.20", "Microsoft Edge";v="112.0.1722.7", "Not:A-Brand";v="99.0.0.0"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-model': '""',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-platform-version': '"15.0.0"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'x-ms-client-request-id': crypto.randomUUID(),
  'x-ms-useragent': 'azsdk-js-api-client-factory/1.0.0-beta.1 core-rest-pipeline/1.10.0 OS/Win32',
  'Referer': 'https://www.bing.com/search?q=Bing+AI&showconv=1&FORM=hpcodx',
  'Referrer-Policy': 'origin-when-cross-origin',
};
