export type Role = "coach" | "teacher" | "guide" | "supervisor";

export type ReportStatus = "open" | "processing" | "done";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type CampSession = {
  id: string;
  name: string;
  city: string;
  startsOn: string;
  endsOn: string;
};

export type Team = {
  id: string;
  sessionId: string;
  name: string;
};

export type ItineraryPoint = {
  id: string;
  sessionId: string;
  teamId?: string;
  name: string;
  sortOrder: number;
};

export type Report = {
  id: string;
  reporterName: string;
  reporterRole: Role;
  sessionId: string;
  teamId?: string;
  pointId?: string;
  category: string;
  content: string;
  status: ReportStatus;
  isUrgent: boolean;
  affectsSettlement: boolean;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

export type BootstrapData = {
  sessions: CampSession[];
  teams: Team[];
  points: ItineraryPoint[];
  categories: string[];
  roles: Array<{ value: Role; label: string }>;
};
