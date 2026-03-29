# Mock Python Service for Stripe Integration
# Assumes 'stripe' is a pre-configured global client

def generate_climate_payment_intent(user_id: str, cart_items: list, opt_in: bool):
    """
    Calculates total and initiates a Stripe PaymentIntent with Climate metadata.
    """
    
    # Calculate subtotal in cents (e.g., $10.50 -> 1050)
    subtotal_cents = sum(item['price_cents'] for item in cart_items)
    
    # Initialize transaction variables
    final_amount = subtotal_cents
    climate_contribution = 0
    metadata = {
        "app_user_id": user_id,
        "climate_opt_in": str(opt_in)
    }

    if opt_in:
        # Calculate 1% for Stripe Climate
        # We use integer division to stay in 'cents'
        climate_contribution = int(subtotal_cents * 0.01)
        final_amount += climate_contribution
        
        # Metadata allows Stripe Climate to attribute the funds correctly
        metadata.update({
            "carbon_removal_contribution_cents": str(climate_contribution),
            "contribution_source": "checkout_toggle_v1",
            "impact_category": "carbon_sequestration"
        })

    try:
        # Mocking the Stripe SDK call
        intent = stripe.PaymentIntent.create(
            amount=final_amount,
            currency="usd",
            automatic_payment_methods={"enabled": True},
            metadata=metadata,
            description="Purchase with Carbon Removal Contribution" if opt_in else "Standard Purchase"
        )

        return {
            "success": True,
            "client_secret": intent.client_secret,
            "breakdown": {
                "subtotal": subtotal_cents,
                "climate_fee": climate_contribution,
                "total": final_amount
            }
        }
    except Exception as e:
        # Log the error and return a failure state
        print(f"Stripe Error: {str(e)}")
        return {"success": False, "error": "Could not initialize payment"}