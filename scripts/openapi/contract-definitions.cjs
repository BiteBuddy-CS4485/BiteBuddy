const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const jsonContent = (schema) => ({
  "application/json": { schema },
});

const dataResponse = (schema) => ({
  type: "object",
  required: ["data"],
  properties: {
    data: schema,
  },
});

const errorResponse = (description) => ({
  description,
  content: jsonContent(ref("ApiError")),
});

const sessionIdPathParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
  description: "Session ID",
};

const components = {
  securitySchemes: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
  schemas: {
    ApiError: {
      type: "object",
      required: ["error"],
      properties: {
        error: { type: "string" },
      },
    },
    HealthResponse: {
      type: "object",
      required: ["status", "message", "timestamp"],
      properties: {
        status: { type: "string", enum: ["ok"] },
        message: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
    AuthUser: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email", nullable: true },
      },
      additionalProperties: true,
    },
    Profile: {
      type: "object",
      required: ["id", "username", "display_name", "created_at", "updated_at"],
      properties: {
        id: { type: "string", format: "uuid" },
        username: { type: "string" },
        display_name: { type: "string" },
        avatar_url: { type: "string", nullable: true },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
    },
    Friendship: {
      type: "object",
      required: [
        "id",
        "requester_id",
        "addressee_id",
        "status",
        "created_at",
        "updated_at",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        requester_id: { type: "string", format: "uuid" },
        addressee_id: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["pending", "accepted", "declined"] },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
        profile: ref("Profile"),
      },
      additionalProperties: true,
    },
    Session: {
      type: "object",
      required: [
        "id",
        "created_by",
        "name",
        "status",
        "latitude",
        "longitude",
        "radius_meters",
        "created_at",
        "updated_at",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        created_by: { type: "string", format: "uuid" },
        name: { type: "string" },
        status: { type: "string", enum: ["waiting", "active", "completed", "cancelled"] },
        latitude: { type: "number" },
        longitude: { type: "number" },
        radius_meters: { type: "integer" },
        price_filter: {
          type: "array",
          items: { type: "string" },
          nullable: true,
        },
        category_filter: { type: "string", nullable: true },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
    },
    SessionMember: {
      type: "object",
      required: ["id", "session_id", "user_id", "joined_at"],
      properties: {
        id: { type: "string", format: "uuid" },
        session_id: { type: "string", format: "uuid" },
        user_id: { type: "string", format: "uuid" },
        joined_at: { type: "string", format: "date-time" },
      },
    },
    SessionMemberWithProfile: {
      allOf: [
        ref("SessionMember"),
        {
          type: "object",
          required: ["profile"],
          properties: {
            profile: ref("Profile"),
          },
        },
      ],
    },
    SessionRestaurant: {
      type: "object",
      required: ["id", "session_id", "yelp_id", "name"],
      properties: {
        id: { type: "string", format: "uuid" },
        session_id: { type: "string", format: "uuid" },
        yelp_id: { type: "string" },
        name: { type: "string" },
        image_url: { type: "string", nullable: true },
        rating: { type: "number", nullable: true },
        review_count: { type: "integer", nullable: true },
        price: { type: "string", nullable: true },
        categories: {
          type: "array",
          nullable: true,
          items: {
            type: "object",
            required: ["alias", "title"],
            properties: {
              alias: { type: "string" },
              title: { type: "string" },
            },
          },
        },
        address: { type: "string", nullable: true },
        latitude: { type: "number", nullable: true },
        longitude: { type: "number", nullable: true },
        phone: { type: "string", nullable: true },
        yelp_url: { type: "string", nullable: true },
      },
    },
    Match: {
      type: "object",
      required: ["id", "session_id", "restaurant_id", "matched_at"],
      properties: {
        id: { type: "string", format: "uuid" },
        session_id: { type: "string", format: "uuid" },
        restaurant_id: { type: "string", format: "uuid" },
        matched_at: { type: "string", format: "date-time" },
      },
    },
    MatchWithRestaurant: {
      allOf: [
        ref("Match"),
        {
          type: "object",
          required: ["restaurant"],
          properties: {
            restaurant: ref("SessionRestaurant"),
          },
        },
      ],
    },
    SwipeResponseData: {
      type: "object",
      required: ["swipe_id", "is_match"],
      properties: {
        swipe_id: { type: "string", format: "uuid" },
        is_match: { type: "boolean" },
        match: {
          allOf: [ref("Match")],
          nullable: true,
        },
      },
    },
    SessionDetails: {
      allOf: [
        ref("Session"),
        {
          type: "object",
          required: ["members", "restaurant_count", "match_count"],
          properties: {
            members: {
              type: "array",
              items: ref("SessionMemberWithProfile"),
            },
            restaurant_count: { type: "integer" },
            match_count: { type: "integer" },
          },
        },
      ],
    },
    SessionResults: {
      type: "object",
      required: ["matches", "total_restaurants", "swipe_progress"],
      properties: {
        matches: {
          type: "array",
          items: ref("MatchWithRestaurant"),
        },
        total_restaurants: { type: "integer" },
        swipe_progress: {
          type: "object",
          additionalProperties: { type: "integer" },
        },
      },
    },
    PlaceBusiness: {
      type: "object",
      required: [
        "id",
        "name",
        "image_url",
        "rating",
        "review_count",
        "price",
        "categories",
        "address",
        "latitude",
        "longitude",
        "phone",
        "url",
      ],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        image_url: { type: "string", nullable: true },
        rating: { type: "number" },
        review_count: { type: "integer" },
        price: { type: "string", nullable: true },
        categories: {
          type: "array",
          items: {
            type: "object",
            required: ["alias", "title"],
            properties: {
              alias: { type: "string" },
              title: { type: "string" },
            },
          },
        },
        address: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        phone: { type: "string" },
        url: { type: "string" },
      },
    },
    RecentMatch: {
      type: "object",
      required: [
        "match_id",
        "session_id",
        "session_name",
        "restaurant_name",
        "restaurant_image_url",
        "restaurant_rating",
        "matched_at",
      ],
      properties: {
        match_id: { type: "string", format: "uuid" },
        session_id: { type: "string", format: "uuid" },
        session_name: { type: "string" },
        restaurant_name: { type: "string" },
        restaurant_image_url: { type: "string", nullable: true },
        restaurant_rating: { type: "number", nullable: true },
        matched_at: { type: "string", format: "date-time" },
      },
    },
    SignupRequest: {
      type: "object",
      required: ["email", "password", "username"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 1 },
        username: { type: "string", minLength: 1 },
        display_name: { type: "string" },
      },
    },
    LoginRequest: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 1 },
      },
    },
    UpdateProfileRequest: {
      type: "object",
      properties: {
        display_name: { type: "string" },
        avatar_url: { type: "string", nullable: true },
      },
    },
    FriendRequestPayload: {
      type: "object",
      required: ["username"],
      properties: {
        username: { type: "string", minLength: 1 },
      },
    },
    FriendRespondPayload: {
      type: "object",
      required: ["friendship_id", "action"],
      properties: {
        friendship_id: { type: "string", format: "uuid" },
        action: { type: "string", enum: ["accept", "decline"] },
      },
    },
    CreateSessionRequest: {
      type: "object",
      required: ["name", "latitude", "longitude"],
      properties: {
        name: { type: "string", minLength: 1 },
        latitude: { type: "number" },
        longitude: { type: "number" },
        radius_meters: { type: "integer", minimum: 1 },
        price_filter: {
          type: "array",
          items: { type: "string" },
        },
        category_filter: { type: "string" },
      },
    },
    InviteFriendsRequest: {
      type: "object",
      required: ["user_ids"],
      properties: {
        user_ids: {
          type: "array",
          minItems: 1,
          items: { type: "string", format: "uuid" },
        },
      },
    },
    SwipeRequest: {
      type: "object",
      required: ["restaurant_id", "liked"],
      properties: {
        restaurant_id: { type: "string", format: "uuid" },
        liked: { type: "boolean" },
      },
    },
    JoinSessionByCodeRequest: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string", minLength: 1 },
      },
    },
  },
};

const endpoints = [
  {
    method: "get",
    path: "/api/health",
    summary: "Service health check",
    tags: ["health"],
    auth: false,
    responses: {
      200: {
        description: "Healthy API response",
        content: jsonContent(ref("HealthResponse")),
      },
    },
  },
  {
    method: "get",
    path: "/api/docs",
    summary: "Swagger UI for the generated API contract",
    tags: ["health"],
    auth: false,
    responses: {
      200: {
        description: "Swagger UI HTML",
        content: {
          "text/html": {
            schema: { type: "string" },
          },
        },
      },
    },
  },
  {
    method: "post",
    path: "/api/auth/signup",
    summary: "Create account",
    tags: ["auth"],
    auth: false,
    requestBody: {
      required: true,
      content: jsonContent(ref("SignupRequest")),
    },
    responses: {
      200: {
        description: "Signup successful",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["user"],
            properties: {
              user: ref("AuthUser"),
              access_token: { type: "string", nullable: true },
              refresh_token: { type: "string", nullable: true },
            },
          })
        ),
      },
      400: errorResponse("Invalid signup payload"),
    },
  },
  {
    method: "post",
    path: "/api/auth/login",
    summary: "Authenticate existing account",
    tags: ["auth"],
    auth: false,
    requestBody: {
      required: true,
      content: jsonContent(ref("LoginRequest")),
    },
    responses: {
      200: {
        description: "Login successful",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["user", "access_token", "refresh_token"],
            properties: {
              user: ref("AuthUser"),
              access_token: { type: "string" },
              refresh_token: { type: "string" },
            },
          })
        ),
      },
      400: errorResponse("Missing credentials"),
      401: errorResponse("Authentication failed"),
    },
  },
  {
    method: "get",
    path: "/api/auth/me",
    summary: "Get current user profile",
    tags: ["auth"],
    responses: {
      200: {
        description: "Profile found",
        content: jsonContent(dataResponse(ref("Profile"))),
      },
      401: errorResponse("Missing or invalid token"),
      404: errorResponse("Profile not found"),
    },
  },
  {
    method: "post",
    path: "/api/auth/logout",
    summary: "Sign out current user",
    tags: ["auth"],
    responses: {
      200: {
        description: "Signed out",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["message"],
            properties: { message: { type: "string" } },
          })
        ),
      },
      401: errorResponse("Missing or invalid token"),
      400: errorResponse("Logout failed"),
    },
  },
  {
    method: "put",
    path: "/api/profile",
    summary: "Update current user profile",
    tags: ["profile"],
    requestBody: {
      required: true,
      content: jsonContent(ref("UpdateProfileRequest")),
    },
    responses: {
      200: {
        description: "Profile updated",
        content: jsonContent(dataResponse(ref("Profile"))),
      },
      401: errorResponse("Missing or invalid token"),
      400: errorResponse("Update failed"),
    },
  },
  {
    method: "get",
    path: "/api/friends",
    summary: "List accepted friends",
    tags: ["friends"],
    responses: {
      200: {
        description: "Accepted friendships",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("Friendship"),
          })
        ),
      },
      401: errorResponse("Missing or invalid token"),
      400: errorResponse("Lookup failed"),
    },
  },
  {
    method: "post",
    path: "/api/friends/request",
    summary: "Send a friend request",
    tags: ["friends"],
    requestBody: {
      required: true,
      content: jsonContent(ref("FriendRequestPayload")),
    },
    responses: {
      201: {
        description: "Friend request sent",
        content: jsonContent(dataResponse(ref("Friendship"))),
      },
      400: errorResponse("Invalid request"),
      401: errorResponse("Missing or invalid token"),
      404: errorResponse("Target user not found"),
      409: errorResponse("Friendship already exists"),
    },
  },
  {
    method: "post",
    path: "/api/friends/respond",
    summary: "Accept or decline a friend request",
    tags: ["friends"],
    requestBody: {
      required: true,
      content: jsonContent(ref("FriendRespondPayload")),
    },
    responses: {
      200: {
        description: "Friend request updated",
        content: jsonContent(dataResponse(ref("Friendship"))),
      },
      400: errorResponse("Invalid response payload"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "get",
    path: "/api/friends/requests",
    summary: "List pending incoming friend requests",
    tags: ["friends"],
    responses: {
      200: {
        description: "Incoming requests",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("Friendship"),
          })
        ),
      },
      401: errorResponse("Missing or invalid token"),
      400: errorResponse("Lookup failed"),
    },
  },
  {
    method: "get",
    path: "/api/friends/requests/sent",
    summary: "List pending sent friend requests",
    tags: ["friends"],
    responses: {
      200: {
        description: "Outgoing requests",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("Friendship"),
          })
        ),
      },
      401: errorResponse("Missing or invalid token"),
      400: errorResponse("Lookup failed"),
    },
  },
  {
    method: "get",
    path: "/api/friends/search",
    summary: "Search users by username",
    tags: ["friends"],
    parameters: [
      {
        name: "q",
        in: "query",
        required: true,
        description: "Username fragment (minimum 2 chars)",
        schema: { type: "string", minLength: 2 },
      },
    ],
    responses: {
      200: {
        description: "Matching profiles",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("Profile"),
          })
        ),
      },
      400: errorResponse("Invalid query"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "get",
    path: "/api/restaurants/discover",
    summary: "Discover nearby restaurants from Google Places",
    tags: ["restaurants"],
    parameters: [
      {
        name: "latitude",
        in: "query",
        required: true,
        schema: { type: "number" },
      },
      {
        name: "longitude",
        in: "query",
        required: true,
        schema: { type: "number" },
      },
      {
        name: "cuisine",
        in: "query",
        required: false,
        schema: { type: "string", default: "all" },
      },
      {
        name: "radius",
        in: "query",
        required: false,
        schema: { type: "integer", default: 5000, minimum: 1 },
      },
    ],
    responses: {
      200: {
        description: "Restaurants found",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["restaurants"],
            properties: {
              restaurants: {
                type: "array",
                items: ref("PlaceBusiness"),
              },
            },
          })
        ),
      },
      400: errorResponse("Missing latitude/longitude"),
      401: errorResponse("Missing or invalid token"),
      500: errorResponse("Places provider failure"),
    },
  },
  {
    method: "get",
    path: "/api/sessions",
    summary: "List sessions for current user",
    tags: ["sessions"],
    parameters: [
      {
        name: "status",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["waiting", "active", "completed"] },
      },
    ],
    responses: {
      200: {
        description: "Session list",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("Session"),
          })
        ),
      },
      401: errorResponse("Missing or invalid token"),
      400: errorResponse("Lookup failed"),
    },
  },
  {
    method: "post",
    path: "/api/sessions",
    summary: "Create a new session",
    tags: ["sessions"],
    requestBody: {
      required: true,
      content: jsonContent(ref("CreateSessionRequest")),
    },
    responses: {
      201: {
        description: "Session created",
        content: jsonContent(dataResponse(ref("Session"))),
      },
      400: errorResponse("Invalid session payload"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "get",
    path: "/api/sessions/recent-matches",
    summary: "Get recent matches across user sessions",
    tags: ["sessions"],
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
    ],
    responses: {
      200: {
        description: "Recent matches",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["matches"],
            properties: {
              matches: {
                type: "array",
                items: ref("RecentMatch"),
              },
            },
          })
        ),
      },
      401: errorResponse("Missing or invalid token"),
      500: errorResponse("Lookup failed"),
    },
  },
  {
    method: "get",
    path: "/api/sessions/{id}",
    summary: "Get session details",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      200: {
        description: "Session details",
        content: jsonContent(dataResponse(ref("SessionDetails"))),
      },
      401: errorResponse("Missing or invalid token"),
      404: errorResponse("Session not found"),
    },
  },
  {
    method: "post",
    path: "/api/sessions/join-by-code",
    summary: "Join a session using an invite code",
    tags: ["sessions"],
    requestBody: {
      required: true,
      content: jsonContent(ref("JoinSessionByCodeRequest")),
    },
    responses: {
      200: {
        description: "User joined session via invite code",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["session_id", "status"],
            properties: {
              session_id: { type: "string", format: "uuid" },
              status: {
                type: "string",
                enum: ["waiting", "active", "completed", "cancelled"],
              },
            },
          })
        ),
      },
      400: errorResponse("Invite code is required"),
      401: errorResponse("Missing or invalid token"),
      404: errorResponse("Invalid invite code"),
      410: errorResponse("This session has already ended"),
    },
  },
  {
    method: "post",
    path: "/api/sessions/{id}/invite",
    summary: "Invite users to a session",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    requestBody: {
      required: true,
      content: jsonContent(ref("InviteFriendsRequest")),
    },
    responses: {
      201: {
        description: "Invites created/upserted",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("SessionMember"),
          })
        ),
      },
      400: errorResponse("Invalid invite payload"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "post",
    path: "/api/sessions/{id}/join",
    summary: "Join a session",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      201: {
        description: "User joined session",
        content: jsonContent(dataResponse(ref("SessionMember"))),
      },
      400: errorResponse("Join failed"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "delete",
    path: "/api/sessions/{id}/leave",
    summary: "Leave a session as a member",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      200: {
        description: "User left session",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["success"],
            properties: {
              success: { type: "boolean", enum: [true] },
            },
          })
        ),
      },
      400: errorResponse("Leave failed"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "post",
    path: "/api/sessions/{id}/cancel",
    summary: "Cancel a session as the host",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      200: {
        description: "Session cancelled",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["success"],
            properties: {
              success: { type: "boolean", enum: [true] },
            },
          })
        ),
      },
      400: errorResponse("Session is already ended"),
      401: errorResponse("Missing or invalid token"),
      403: errorResponse("Only the host can cancel this session"),
      404: errorResponse("Session not found"),
    },
  },
  {
    method: "get",
    path: "/api/sessions/{id}/restaurants",
    summary: "List restaurants loaded for a session",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      200: {
        description: "Session restaurants",
        content: jsonContent(
          dataResponse({
            type: "array",
            items: ref("SessionRestaurant"),
          })
        ),
      },
      400: errorResponse("Lookup failed"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "get",
    path: "/api/sessions/{id}/results",
    summary: "Get session results and swipe progress",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      200: {
        description: "Session results",
        content: jsonContent(dataResponse(ref("SessionResults"))),
      },
      400: errorResponse("Lookup failed"),
      401: errorResponse("Missing or invalid token"),
    },
  },
  {
    method: "post",
    path: "/api/sessions/{id}/start",
    summary: "Start a waiting session and fetch restaurants",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    responses: {
      200: {
        description: "Session started",
        content: jsonContent(
          dataResponse({
            type: "object",
            required: ["restaurant_count"],
            properties: {
              restaurant_count: { type: "integer", minimum: 0 },
            },
          })
        ),
      },
      400: errorResponse("Start failed"),
      401: errorResponse("Missing or invalid token"),
      403: errorResponse("Only creator can start session"),
      404: errorResponse("Session not found"),
      502: errorResponse("Restaurant provider failure"),
    },
  },
  {
    method: "post",
    path: "/api/sessions/{id}/swipe",
    summary: "Submit a swipe for a restaurant",
    tags: ["sessions"],
    parameters: [sessionIdPathParam],
    requestBody: {
      required: true,
      content: jsonContent(ref("SwipeRequest")),
    },
    responses: {
      200: {
        description: "Swipe accepted",
        content: jsonContent(dataResponse(ref("SwipeResponseData"))),
      },
      400: errorResponse("Invalid swipe payload"),
      401: errorResponse("Missing or invalid token"),
    },
  },
];

module.exports = {
  components,
  endpoints,
};
