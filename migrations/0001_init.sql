-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tier" TEXT,
    "billingInterval" TEXT,
    "householdPrimaryUserId" TEXT,
    "shopAccess" BOOLEAN NOT NULL DEFAULT false,
    "isTeacher" BOOLEAN NOT NULL DEFAULT false,
    "dayPassCreditExpiresAt" DATETIME,
    "scholarshipExpiresAt" DATETIME,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "kioskPinHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "User_householdPrimaryUserId_fkey" FOREIGN KEY ("householdPrimaryUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "label" TEXT,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaiverSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL,
    "fullNameTyped" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "WaiverSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "policySlug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "knowledgeOnly" BOOLEAN NOT NULL DEFAULT false,
    "requiresCertificationIds" TEXT NOT NULL,
    "expiryMonths" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "UserCertification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "knowledgePassedAt" DATETIME,
    "checkedOffAt" DATETIME,
    "checkedOffById" TEXT,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UserCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserCertification_checkedOffById_fkey" FOREIGN KEY ("checkedOffById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserCertification_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "requiredCertificationIds" TEXT NOT NULL,
    "readerKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reservationRecommended" BOOLEAN NOT NULL DEFAULT false,
    "reservationRequired" BOOLEAN NOT NULL DEFAULT false,
    "attendedOperationRequired" BOOLEAN NOT NULL DEFAULT false,
    "locationLabel" TEXT NOT NULL DEFAULT '',
    "gettingStartedVideoUrl" TEXT,
    "maxReservationHours" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hourlyRateCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "MaintenanceBlock_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "reservationId" TEXT,
    "endedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UsageSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "readerKey" TEXT NOT NULL,
    "machineId" TEXT,
    "badgeUid" TEXT NOT NULL,
    "userId" TEXT,
    "allow" BOOLEAN NOT NULL,
    "reason" TEXT,
    "reservationNotice" TEXT,
    "sessionId" TEXT,
    "requestedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AccessLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descriptionSlug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "zeffyUrl" TEXT,
    "zeffyCampaignId" TEXT,
    "prerequisiteCertificationIds" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "cancellationCutoffHours" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ClassSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "waitlistPosition" INTEGER,
    "paidAt" DATETIME,
    "paidMarkedById" TEXT,
    "zeffyPaymentId" TEXT,
    "paymentHoldExpiresAt" DATETIME,
    "cancelledAt" DATETIME,
    "attendedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Booking_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_paidMarkedById_fkey" FOREIGN KEY ("paidMarkedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sourcePaymentId" TEXT,
    "usageSessionId" TEXT,
    "workstationSessionId" TEXT,
    "equipmentJobId" TEXT,
    "bookingId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CreditLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditLedgerEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreditLedgerEntry_usageSessionId_fkey" FOREIGN KEY ("usageSessionId") REFERENCES "UsageSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreditLedgerEntry_workstationSessionId_fkey" FOREIGN KEY ("workstationSessionId") REFERENCES "WorkstationSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreditLedgerEntry_equipmentJobId_fkey" FOREIGN KEY ("equipmentJobId") REFERENCES "EquipmentJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreditLedgerEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassInterestBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "threshold" INTEGER NOT NULL DEFAULT 8,
    "proposedByUserId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "instructorHintUserId" TEXT,
    "opensAt" DATETIME,
    "closesAt" DATETIME,
    "scheduledClassSessionId" TEXT,
    "priorityBookingEndsAt" DATETIME,
    "resuggestedFromId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "staffNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ClassInterestBoard_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClassInterestBoard_instructorHintUserId_fkey" FOREIGN KEY ("instructorHintUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClassInterestBoard_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassInterestSignup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ClassInterestSignup_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ClassInterestBoard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassInterestSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ZeffyWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "payloadJson" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "LearningModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "knowledgeOnly" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "equipmentStatus" TEXT NOT NULL DEFAULT 'confirmed',
    "passThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "attemptLimit" INTEGER NOT NULL DEFAULT 3,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "LearningModule_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentSlug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 10,
    "gap" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LearningModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'youtube',
    "youtubeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'primary',
    "condition" TEXT,
    "durationSeconds" INTEGER,
    "verifiedAt" DATETIME,
    "staffReviewed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "LessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "correctIndexes" TEXT,
    "explanation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "safetyCritical" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'video',
    "sourceVideoId" TEXT,
    "verifyAgainstVideo" BOOLEAN NOT NULL DEFAULT true,
    "answerPending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Question_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LearningModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "watchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "VideoWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VideoWatch_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "LessonVideo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "questionIds" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "thresholdMet" BOOLEAN NOT NULL DEFAULT false,
    "safetyCriticalMissedIds" TEXT,
    "startedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LearningModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notionId" TEXT,
    "googleFileId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "markdownPath" TEXT,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "syncedAt" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VolunteerRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentSlug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VolunteerInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "roleId" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "userId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "VolunteerInterest_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "VolunteerRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VolunteerInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VolunteerInterest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "businessName" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "claimedByUserId" TEXT,
    "claimedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Bounty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bounty_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MembershipProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "annualPriceCents" INTEGER,
    "shopAccess" BOOLEAN NOT NULL DEFAULT true,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "visibleOnJoin" BOOLEAN NOT NULL DEFAULT true,
    "joinable" BOOLEAN NOT NULL DEFAULT true,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAddOn" BOOLEAN NOT NULL DEFAULT false,
    "cappedSeats" INTEGER,
    "zeffyCampaignId" TEXT,
    "zeffyRateId" TEXT,
    "zeffyUrl" TEXT,
    "creditGrantCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "orgName" TEXT NOT NULL,
    "paymentUrl" TEXT NOT NULL,
    "donationUrl" TEXT NOT NULL,
    "scholarshipDonationUrl" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "hoursContentSlug" TEXT NOT NULL,
    "currentWaiverVersion" TEXT NOT NULL,
    "memberExpectationsPolicySlug" TEXT NOT NULL,
    "quizPassThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "quizAttemptLimit" INTEGER NOT NULL DEFAULT 3,
    "quizQuestionCount" INTEGER NOT NULL DEFAULT 10,
    "requireSafetyCriticalAll" BOOLEAN NOT NULL DEFAULT true,
    "classCancellationCutoffHours" INTEGER NOT NULL DEFAULT 24,
    "paymentHoldHours" INTEGER NOT NULL DEFAULT 48,
    "reservationHorizonDays" INTEGER NOT NULL DEFAULT 14,
    "maxHoursPerDay" INTEGER NOT NULL DEFAULT 3,
    "maxOpenReservations" INTEGER NOT NULL DEFAULT 3,
    "reservationSlotMinutes" INTEGER NOT NULL DEFAULT 30,
    "communitySeatCap" INTEGER NOT NULL DEFAULT 12,
    "makerMonthlyCents" INTEGER NOT NULL DEFAULT 4000,
    "patronScholarshipSurchargeCents" INTEGER NOT NULL DEFAULT 2000,
    "scholarshipFundBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "scholarshipSeatsAwarded" INTEGER NOT NULL DEFAULT 0,
    "showPhase3Tiers" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "subjectUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "qrUrl" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "DisplayConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "panelOrder" TEXT NOT NULL,
    "cadenceSeconds" INTEGER NOT NULL DEFAULT 12,
    "pinnedPanel" TEXT,
    "nameDisplayMode" TEXT NOT NULL DEFAULT 'first',
    "membershipEveryNRotations" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "billedMachineId" TEXT NOT NULL,
    "idleLockMinutes" INTEGER NOT NULL DEFAULT 10,
    "idleLogoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Workstation_billedMachineId_fkey" FOREIGN KEY ("billedMachineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkstationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workstationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "billedMachineId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "endedBy" TEXT,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "WorkstationSession_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkstationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkstationLaunch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workstationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "softwareMapId" TEXT,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "exeName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkstationLaunch_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkstationLaunch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkstationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkstationLaunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkstationLaunch_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkstationLaunch_softwareMapId_fkey" FOREIGN KEY ("softwareMapId") REFERENCES "MachineSoftwareMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineSoftwareMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT,
    "workstationId" TEXT,
    "displayName" TEXT NOT NULL,
    "exeName" TEXT NOT NULL,
    "exePath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "MachineSoftwareMap_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MachineSoftwareMap_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkstationLoginChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workstationId" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "approvedUserId" TEXT,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkstationLoginChallenge_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkstationLoginChallenge_approvedUserId_fkey" FOREIGN KEY ("approvedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "workstationId" TEXT,
    "workstationSessionId" TEXT,
    "usageSessionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "filamentGrams" REAL,
    "sheets" INTEGER,
    "runtimeSeconds" INTEGER,
    "billedCents" INTEGER,
    "note" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EquipmentJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentJob_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentJob_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EquipmentJob_workstationSessionId_fkey" FOREIGN KEY ("workstationSessionId") REFERENCES "WorkstationSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_uid_key" ON "Badge"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_slug_key" ON "Certification"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserCertification_userId_certificationId_key" ON "UserCertification"("userId", "certificationId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_readerKey_key" ON "Machine"("readerKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_slug_key" ON "ClassSession"("slug");

-- CreateIndex
CREATE INDEX "ClassSession_zeffyCampaignId_idx" ON "ClassSession"("zeffyCampaignId");

-- CreateIndex
CREATE INDEX "Booking_zeffyPaymentId_idx" ON "Booking"("zeffyPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_workstationSessionId_key" ON "CreditLedgerEntry"("workstationSessionId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_userId_idx" ON "CreditLedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_sourcePaymentId_idx" ON "CreditLedgerEntry"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_usageSessionId_idx" ON "CreditLedgerEntry"("usageSessionId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_equipmentJobId_idx" ON "CreditLedgerEntry"("equipmentJobId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_bookingId_idx" ON "CreditLedgerEntry"("bookingId");

-- CreateIndex
CREATE INDEX "ClassInterestBoard_status_idx" ON "ClassInterestBoard"("status");

-- CreateIndex
CREATE INDEX "ClassInterestBoard_scheduledClassSessionId_idx" ON "ClassInterestBoard"("scheduledClassSessionId");

-- CreateIndex
CREATE INDEX "ClassInterestSignup_boardId_idx" ON "ClassInterestSignup"("boardId");

-- CreateIndex
CREATE INDEX "ClassInterestSignup_email_idx" ON "ClassInterestSignup"("email");

-- CreateIndex
CREATE INDEX "ZeffyWebhookEvent_paymentId_idx" ON "ZeffyWebhookEvent"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningModule_slug_key" ON "LearningModule"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_moduleId_slug_key" ON "Lesson"("moduleId", "slug");

-- CreateIndex
CREATE INDEX "LessonVideo_lessonId_idx" ON "LessonVideo"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoWatch_userId_videoId_key" ON "VideoWatch"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_googleFileId_key" ON "ContentPage"("googleFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerRole_slug_key" ON "VolunteerRole"("slug");

-- CreateIndex
CREATE INDEX "Bounty_status_idx" ON "Bounty"("status");

-- CreateIndex
CREATE INDEX "Bounty_claimedByUserId_idx" ON "Bounty"("claimedByUserId");

-- CreateIndex
CREATE INDEX "MembershipProduct_zeffyCampaignId_idx" ON "MembershipProduct"("zeffyCampaignId");

-- CreateIndex
CREATE INDEX "MembershipProduct_zeffyRateId_idx" ON "MembershipProduct"("zeffyRateId");

-- CreateIndex
CREATE UNIQUE INDEX "Workstation_deviceId_key" ON "Workstation"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkstationSession_tokenHash_key" ON "WorkstationSession"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkstationSession_workstationId_endedAt_idx" ON "WorkstationSession"("workstationId", "endedAt");

-- CreateIndex
CREATE INDEX "WorkstationSession_userId_idx" ON "WorkstationSession"("userId");

-- CreateIndex
CREATE INDEX "WorkstationLaunch_sessionId_idx" ON "WorkstationLaunch"("sessionId");

-- CreateIndex
CREATE INDEX "WorkstationLoginChallenge_workstationId_idx" ON "WorkstationLoginChallenge"("workstationId");

-- CreateIndex
CREATE INDEX "EquipmentJob_userId_completedAt_idx" ON "EquipmentJob"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "EquipmentJob_machineId_idx" ON "EquipmentJob"("machineId");

