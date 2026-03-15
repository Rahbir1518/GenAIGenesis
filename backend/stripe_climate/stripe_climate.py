# Mock Python Backend (FastAPI/Flask style)
# Handles the Stripe PaymentIntent creation with Climate metadata

def create_checkout_session(user_id: str, items: list, donate_to_climate: bool):
    """
    Creates a Stripe PaymentIntent. If the toggle is True, 
    calculates the 1% contribution for carbon removal.
    """
    base_total = sum(item['price'] for item in items)
    currency = "usd"
    
    # Logic for the 1% Contribution
    metadata = {"user_id": user_id, "contribution_type": "none"}
    
    if donate_to_climate:
        # Calculate 1% (e.g., $100.00 -> $1.00)
        contribution_amount = int(base_total * 0.01)
        total_with_contribution = base_total + contribution_amount
        
        # Stripe Climate API requires specific metadata flags to 
        # trigger their carbon removal downstream logic.
        metadata.update({
            "stripe_climate_enabled": "true",
            "carbon_removal_fee_cents": str(contribution_amount),
            "project": "frontier_climate_batch_2026"
        })
    else:
        total_with_contribution = base_total

    # Mock call to stripe.PaymentIntent.create
    payment_intent = stripe_client.payment_intents.create(
        amount=total_with_contribution,
        currency=currency,
        payment_method_types=["card"],
        metadata=metadata
    )

    return {
        "client_secret": payment_intent.client_secret,
        "total": total_with_contribution,
        "is_climate_active": donate_to_climate
    }