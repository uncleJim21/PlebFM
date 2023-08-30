import NextAuth, { Session, User } from 'next-auth';
import { JWT as NextAuthJWT } from 'next-auth/jwt';

import SpotifyProvider from 'next-auth/providers/spotify';

type GenericObject<T = unknown> = T & {
  [key: string]: any;
};
interface JWT extends NextAuthJWT {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  error?: string;
  user?: Session['user'];
}

interface JwtInterface {
  token: JWT;
  user: User;
  account: GenericObject;
}
/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken as string,
    });
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body as BodyInit,
    });
    const data = await res.json();
    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
    };
  } catch (error) {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
};

export default NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      authorization:
        'https://accounts.spotify.com/authorize?scope=user-read-playback-state,user-modify-playback-state,user-read-playback-position,streaming,user-read-email,user-read-private',
    }),
  ],
  callbacks: {
    //@ts-ignore
    async jwt({ token, user, account }: JwtInterface): Promise<JWT> {
      if (account && user) {
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at * 1000,
          user,
        };
      } else if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires
      ) {
        return token;
      } else {
        const newToken = await refreshAccessToken(token);
        return newToken;
      }
      // return res;
    },
    // @ts-ignore
    async session({
      session,
      token,
    }: {
      token: GenericObject;
      session: Session;
    }): Promise<GenericObject> {
      // @ts-ignore
      session.accessToken = token.accessToken;
      // @ts-ignore
      session.error = token.error;
      session.user = token.user;
      return session;
    },
  },
});
