import { unescape, stringify, type ParsedUrlQueryInput } from 'node:querystring';

export function pki({ authHeaders, url, httpMethod, query, body, context }: { 
    authHeaders: Record<string, string>, 
    url: string, 
    httpMethod: string,
    query: string,
    body: string,
    context: Record<string, string> 
}) {
    const { signature, app_id, nonce, timestamp } = authHeaders;
  
    const params = Object.assign(
      {},
      query,
      body,
      {
        nonce,
        app_id,
        signature_method: 'RS256',
        timestamp,
      },
      context['client_secret'] && context['redirect_uri'] ? context : {},
    )
  
    const sortedParams = Object.fromEntries(
      Object.entries(params).sort(([k1], [k2]) => k1.localeCompare(k2)),
    ) as ParsedUrlQueryInput;
  
    const baseString =
      httpMethod.toUpperCase() +
      '&' +
      url +
      '&' +
      unescape(stringify(sortedParams))
  
    return { signature, baseString }
}