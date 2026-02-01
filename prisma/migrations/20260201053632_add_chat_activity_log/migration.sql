-- CreateTable
CREATE TABLE "ChatActivity" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "role" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatActivity_phone_idx" ON "ChatActivity"("phone");

-- CreateIndex
CREATE INDEX "ChatActivity_createdAt_idx" ON "ChatActivity"("createdAt");
