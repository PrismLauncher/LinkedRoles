import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function storeDiscordTokens(userId, tokens) {
  await prisma.user.create({
    data: {
      id: userId,
      token: tokens,
    },
  })
}

export async function getDiscordTokens(userId) {
  await prisma.user.get({
    data: {
      id: userId,
    },
  })
}
