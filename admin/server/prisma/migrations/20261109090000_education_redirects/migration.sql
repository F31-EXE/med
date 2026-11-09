DELETE FROM "Redirect" WHERE "fromPath" = '/obuchenie';
UPDATE "Redirect" SET "toPath" = '/obuchenie', "updatedAt" = CURRENT_TIMESTAMP
WHERE "fromPath" IN ('/programma-obucheniya', '/uchebnyj-plan', '/diplom-ustanovlennogo-obrazca', '/forma-zayavki-na-obuchenie');
