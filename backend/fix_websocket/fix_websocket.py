# Mock Python Backend Fix
# Focus: Manual cleanup of the connection registry to prevent heap exhaustion.

class ConnectionManager:
    def __init__(self):
        # The 'ActiveConnections' map mentioned in the ticket
        self.active_connections: dict[str, object] = {}

    async def connect(self, user_id: str, websocket: object):
        await websocket.accept()
        # Store the reference
        self.active_connections[user_id] = websocket
        print(f"Connection added: {user_id}. Total: {len(self.active_connections)}")

    async def disconnect(self, user_id: str):
        """
        THE FIX: Explicitly popping the user from the dict.
        Without this, the 'websocket' object stays in memory forever.
        """
        if user_id in self.active_connections:
            # Remove reference so GC can reclaim memory
            self.active_connections.pop(user_id)
            print(f"Memory Purged: {user_id}. Total remaining: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        # We iterate over a copy to avoid 'dict size changed during iteration' errors
        for user_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_text(message)
            except Exception:
                # If sending fails, the client is likely a 'zombie'
                await self.disconnect(user_id)

# Usage in a mock endpoint
# manager = ConnectionManager()
# try:
#     await manager.connect(user_id, websocket)
#     while True:
#         data = await websocket.receive_text()
# finally:
#     await manager.disconnect(user_id)