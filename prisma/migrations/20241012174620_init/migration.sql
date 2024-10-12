/*
  Warnings:

  - You are about to drop the column `isUser` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the `Edit` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Edit" DROP CONSTRAINT "Edit_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isUser",
ADD COLUMN     "role" TEXT NOT NULL;

-- DropTable
DROP TABLE "Edit";

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
