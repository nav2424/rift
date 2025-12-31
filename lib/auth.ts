import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("AUTH: Missing email or password")
            return null
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              passwordHash: true,
              emailVerified: true,
              phoneVerified: true,
            },
          })

          if (!user) {
            console.log("AUTH: no user for", credentials.email)
            return null
          }

          const passwordOk = await bcrypt.compare(credentials.password, user.passwordHash ?? "")
          console.log("AUTH:", {
            email: user.email,
            hasHash: Boolean(user.passwordHash),
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            passwordOk,
            role: user.role,
          })

          if (!passwordOk) {
            console.log("AUTH: Password mismatch for", user.email)
            return null
          }

          // Check if user has verified email and phone (required to access platform)
          // ADMIN users can bypass verification requirements
          // Note: NextAuth authorize must return null on failure, so we return null here
          // Verification check will be done in signin page/middleware
          if (user.role !== 'ADMIN' && (!user.emailVerified || !user.phoneVerified)) {
            console.log("AUTH: Verification check failed for", user.email, {
              emailVerified: user.emailVerified,
              phoneVerified: user.phoneVerified,
              role: user.role,
            })
            return null // Return null so signin fails - frontend will check verification separately
          }

          console.log("AUTH: Success for", user.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as 'USER' | 'ADMIN',
          }
        } catch (error) {
          console.error('Auth authorize error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      try {
        // On initial sign in, set user data
        if (user) {
          token.id = user.id
          token.role = (user as any).role
          token.name = user.name
        }
        
        // When session is updated (e.g., profile changes), update the token
        if (trigger === 'update' && session?.name !== undefined) {
          token.name = session.name
        }
        
        // If name is not in token, fetch it from database
        if (!token.name && token.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true },
          })
          if (dbUser) {
            token.name = dbUser.name
          }
        }
        
        return token
      } catch (error) {
        console.error('JWT callback error:', error)
        return token
      }
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = token.id as string
          session.user.role = token.role as 'USER' | 'ADMIN'
          session.user.name = token.name as string | null | undefined
        }
        return session
      } catch (error) {
        console.error('Session callback error:', error)
        return session
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NEXTAUTH_DEBUG === 'true',
}

