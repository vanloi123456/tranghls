/**
 * Firebase Cloud Functions (Backend) reference for atomic Promo Code redemption
 * and anti-cheat AI credit deduction against Firestore collection `promo_codes` and `users`.
 *
 * Notice: In the active full-stack Express runtime (server.ts), equivalent backend endpoints
 * (`/api/promo-codes/redeem` and `/api/credits/consume`) verify Firebase ID tokens and commit
 * atomic Firestore transactions so no credit calculation happens purely on the client.
 */

export const FIRESTORE_DATABASE_ID =
  'ai-studio-hcliusgiovinsngt-cb916116-a1d6-465b-a85b-408c99d3044d';

export interface CloudFunctionContext {
  auth?: {
    uid: string;
    token?: {
      email?: string;
      email_verified?: boolean;
    };
  };
}

/**
 * Atomic transaction logic intended for Firebase Cloud Functions (v2 onCall)
 * using firebase-admin Firestore instance.
 */
export async function executeRedeemPromoCodeTransaction(
  db: any,
  FieldValue: any,
  uid: string,
  rawCode: string
): Promise<{ success: boolean; addedCredits: number; newCredits: number; code: string }> {
  const cleanCode = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,64}$/.test(cleanCode)) {
    throw new Error('Mã kích hoạt không đúng định dạng.');
  }

  const promoRef = db.collection('promo_codes').doc(cleanCode);
  const userRef = db.collection('users').doc(uid);

  return await db.runTransaction(async (tx: any) => {
    const [promoSnap, userSnap] = await Promise.all([tx.get(promoRef), tx.get(userRef)]);

    if (!promoSnap.exists) {
      throw new Error('Mã kích hoạt không tồn tại trong hệ thống.');
    }

    const promoData = promoSnap.data();
    if (!promoData || promoData.is_used === true) {
      throw new Error('Mã kích hoạt này đã được sử dụng.');
    }

    const creditValue = Number(promoData.credit_value || 0);
    if (!Number.isInteger(creditValue) || creditValue <= 0) {
      throw new Error('Giá trị tín dụng của mã kích hoạt không hợp lệ.');
    }

    const currentCredits = userSnap.exists ? Number(userSnap.data()?.credits || 0) : 10;
    const newCredits = currentCredits + creditValue;

    tx.update(promoRef, {
      is_used: true,
      used_by: uid,
      used_at: FieldValue.serverTimestamp(),
    });

    if (userSnap.exists) {
      tx.update(userRef, {
        credits: newCredits,
        lastRedeemedCode: cleanCode,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(userRef, {
        uid,
        credits: 10 + creditValue,
        role: 'teacher',
        lastRedeemedCode: cleanCode,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      addedCredits: creditValue,
      newCredits,
      code: cleanCode,
    };
  });
}
