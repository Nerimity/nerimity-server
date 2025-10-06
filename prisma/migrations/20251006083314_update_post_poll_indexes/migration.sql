-- CreateIndex
CREATE INDEX "post_poll_choices_pollId_idx" ON "public"."post_poll_choices"("pollId");

-- CreateIndex
CREATE INDEX "post_polls_postId_idx" ON "public"."post_polls"("postId");
