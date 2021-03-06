'use strict';

/**
 * @file
 * Setup service provicer
 */

import Provider from './provider/Provider.js';
import AutoRequire from './provider/lib/AutoRequire.js';
import ClientCache from './provider/lib/ClientCache.js';
import path from 'path';

// import clients
import Borchk from './services/BorrowerCheck/client.js';
import DdbContent from './services/DDBContent/client.js';
import EntitySuggest from './services/EntitySuggest/client.js';
import MobilSoegProfile from './services/MobilSoegProfile/client.js';
import MoreInfo from './services/MoreInfo/client.js';
import OpenAgency from './services/OpenAgency/client.js';
import OpenHoldingStatus from './services/OpenHoldingStatus/client.js';
import OpenOrder from './services/OpenOrder/client.js';
import OpenSearch from './services/OpenSearch/client.js';
import OpenSuggest from './services/OpenSuggest/OpenSuggest.client.js';
import OpenUserStatus from './services/OpenUserStatus/client.js';
import PopSuggest from './services/PopSuggest/client.js';
import RankedRecommendations from './services/RankedRecommendations/RankedRecommendation.client.js';
import Recommendations from './services/Recommendations/Recommendation.client.js';
import MetaRecommendations from './services/MetaRecommendations/Recommendation.client.js';

/**
 * Helper function for registering service clients. If cachetime is defined in config, wrap methods with the
 * client cache manager
 *
 * @param provider
 * @param config
 * @param clientCache
 * @param clientName
 * @param client
 */
function registerServiceClient(provider, config, clientCache, clientName, client) {
  const methods = client(config[clientName]);
  const cache = config[clientName].cache || null;
  if (cache) {
    provider.registerServiceClient(clientName, clientCache(methods, cache));
  }
  else {
    provider.registerServiceClient(clientName, methods);
  }

}

/**
 * Method for initializing all service clients and transforms
 *
 * @param config
 * @param logger
 * @param sockets
 * @returns {Provider}
 */
export default function initProvider(config, logger) {
  const provider = Provider(logger);

  const RegisterClientOnProvider = registerServiceClient.bind(null, provider, config.provider.services, ClientCache(config.cache));

  // Register all clients
  RegisterClientOnProvider('borchk', Borchk);
  RegisterClientOnProvider('ddbcontent', DdbContent);
  RegisterClientOnProvider('entitysuggest', EntitySuggest);
  RegisterClientOnProvider('mobilSoegProfile', MobilSoegProfile);
  RegisterClientOnProvider('moreinfo', MoreInfo);
  RegisterClientOnProvider('openagency', OpenAgency);
  RegisterClientOnProvider('openholdingstatus', OpenHoldingStatus);
  RegisterClientOnProvider('openorder', OpenOrder);
  RegisterClientOnProvider('opensearch', OpenSearch);
  RegisterClientOnProvider('opensuggest', OpenSuggest);
  RegisterClientOnProvider('openuserstatus', OpenUserStatus);
  RegisterClientOnProvider('popsuggest', PopSuggest);
  RegisterClientOnProvider('recommendranked', RankedRecommendations);
  RegisterClientOnProvider('recommend', Recommendations);
  RegisterClientOnProvider('recommendmeta', MetaRecommendations);

  // Transforms are autorequired to lessen boilerplate code
  AutoRequire(path.join(__dirname, 'transformers'), 'transform.js').map(provider.registerTransform);

  return provider;
}
