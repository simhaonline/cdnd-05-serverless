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
  logger.info('Authorizing a user', event.authorizationToken);
  try {
    const jwtToken = await verifyToken(event.authorizationToken);
    logger.info('User was authorized', jwtToken);

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
  logger.info("Token", token);

  const jwt: Jwt = decode(token, {complete: true}) as Jwt;
  logger.info("JWT", jwt);

  const response = await Axios.get<Jwk[]>(jwksUrl);
  logger.info("JWK Request response", response);


  const jwk: Jwk = response.data.reduce(key => {
    if (key.kid === jwt.header.kid) {
      return key;
    }
  });

  if (!jwk) {
    logger.error("Invalid signing key ID.");
    throw new Error('Invalid signing key ID.');
  }

  logger.info("JWK", jwk);

  const cert = addCertWrapper(jwk.x5c[0]);
  logger.info("Cert", cert);

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
  return "-----BEGIN CERTIFICATE-----"+cert+"-----END CERTIFICATE-----";
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
