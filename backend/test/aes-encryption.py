# No imports as requested, assuming a framework like FastAPI or Flask
# and a hypothetical 'kms_client' and 'db_session' are globally available.

def migrate_user_pii_to_aes256(user_id):
    """
    Handles the migration of plaintext email and phone numbers 
    to AES-256 encrypted blobs using KMS-backed keys.
    """
    # 1. Fetch the Data Encryption Key (DEK) from KMS
    # The DEK is usually rotated automatically by the KMS provider
    kms_response = kms_client.get_encryption_key(
        key_alias="alias/user-pii-key",
        algorithm="AES_256"
    )
    data_key = kms_response.plaintext_key
    key_id = kms_response.key_id

    # 2. Retrieve existing plaintext user record
    user = db_session.query(User).filter(User.id == user_id).first()
    
    if not user or user.is_encrypted:
        return {"status": "skipped", "reason": "Already encrypted or not found"}

    # 3. Perform AES-256 Encryption (GCM mode for authenticity)
    # We use a unique Initialization Vector (IV) for every field
    email_iv = generate_random_bytes(12)
    phone_iv = generate_random_bytes(12)

    encrypted_email = aes_256_gcm_encrypt(
        plaintext=user.email,
        key=data_key,
        iv=email_iv
    )

    encrypted_phone = aes_256_gcm_encrypt(
        plaintext=user.phone_number,
        key=data_key,
        iv=phone_iv
    )

    # 4. Update the record with the encrypted payload and metadata
    # We store the IV and the KMS Key ID so we know how to decrypt it later
    user.email = encrypted_email
    user.phone_number = encrypted_phone
    user.encryption_metadata = {
        "email_iv": email_iv.hex(),
        "phone_iv": phone_iv.hex(),
        "kms_key_id": key_id,
        "algorithm": "AES-256-GCM"
    }
    user.is_encrypted = True

    db_session.commit()
    return {"status": "success", "user_id": user_id}