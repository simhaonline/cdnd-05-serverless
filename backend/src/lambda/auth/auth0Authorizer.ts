import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import Axios from 'axios'
import { decode, verify } from 'jsonwebtoken'
import 'source-map-support/register'
import { Jwt } from '../../auth/Jwt'
import { JwtPayload } from '../../auth/JwtPayload'
import { createLogger } from '../../utils/logger'


const logger = createLogger('auth');

const jwksUrl = 'https://scgrk-dev.auth0.com/.well-known/jwks.json';

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', {AuthToken: event.authorizationToken});
  try {
    const jwtToken = await verifyToken(event.authorizationToken);
    logger.info('User was authorized', {token: jwtToken});

    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {
    logger.error('User not authorized', { error: e.message });

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
};

async function verifyToken(authHeader: string): Promise<JwtPayload> {
  const token = getToken(authHeader);
  const jwt: Jwt = decode(token, {complete: true}) as Jwt;
  const response = await Axios.get(jwksUrl);
  const jwkList: Jwk[] = response.data.keys;

  const jwk: Jwk = jwkList.reduce(key => {
    if (key.kid === jwt.header.kid) {
      return key;
    }
  });

  logger.info("JWK", {jwk:jwk});

  if (!jwk) {
    logger.error("Invalid signing key ID. jwk not found");
    throw new Error('Invalid signing key ID.');
  }

  const cert = addCertWrapper(jwk.x5c[0]);

  return verify(token, cert, {algorithms: [jwk.alg]}) as JwtPayload;
}

function getToken(authHeader: string): string {
  if (!authHeader) {
    throw new Error('No authentication header');
  }

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('Invalid authentication header');
  }

  const split = authHeader.split(' ');
  const token = split[1];

  return token;
}

function addCertWrapper(cert: string): string {
  return "-----BEGIN CERTIFICATE-----\n"+cert+"\n-----END CERTIFICATE-----";
}

// Generated by https://quicktype.io

interface Jwk {
  alg: string;    // algorithm used
  kty: string;    // key type
  use: string;    // how to use (`sig` for signature)
  n: string;      // modulus for pem
  e: string;      // exponent for pem
  kid: string;    // id for key
  x5t: string;    // sha-1 thumbprint for x509 cert chain
  x5c: string[];  // x509 cert chain
}
