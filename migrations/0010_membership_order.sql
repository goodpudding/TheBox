-- Join page order: Friend of The Box first, household add-on last.
UPDATE "MembershipProduct" SET "sortOrder" = CASE "tier"
  WHEN 'friend' THEN 10
  WHEN 'day' THEN 20
  WHEN 'community' THEN 30
  WHEN 'maker' THEN 40
  WHEN 'patron' THEN 50
  WHEN 'scholarship' THEN 60
  WHEN 'shop_steward' THEN 70
  WHEN 'household_addon' THEN 80
  WHEN 'maker_pro' THEN 90
  WHEN 'unlimited' THEN 100
  WHEN 'team' THEN 110
  ELSE "sortOrder"
END;
