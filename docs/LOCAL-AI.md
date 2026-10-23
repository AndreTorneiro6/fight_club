# Local admin assistant removed

The Ollama assistant was retired at the user's request on 23 October 2026 because it did not work well enough and occupied server space.

The admin navigation, search entry, interface, API endpoints, model client, installer, check scripts and dedicated Docker service/image definition have been removed. There is no replacement cloud AI service. Existing league data and historical audit records remain unchanged.

The Raspberry Pi cleanup removes only the identified Fight Club Ollama container, its dedicated image and `.local-ai` runtime/model directory. Application, MongoDB, backup and other project services are retained. Do not run general Docker volume pruning or delete competition data as part of removing this feature.
