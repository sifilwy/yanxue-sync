export type Role = "coach" | "teacher" | "guide" | "supervisor";

export type ReportStatus = "open" | "processing" | "done";
export type AttendanceStatus = "pending" | "present" | "absent";

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
  imageThumbUrls?: string[];
  createdAt: string;
  updatedAt: string;
};

export type StaffMember = {
  id: string;
  groupName: string;
  sequence: string;
  type: string;
  name: string;
  idCard: string;
  gender: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type Participant = {
  id: string;
  groupName: string;
  sequence: string;
  familyType: string;
  parent1Name: string;
  parent1IdCard: string;
  parent1Phone: string;
  parent2Name: string;
  parent2IdCard: string;
  parent2Phone: string;
  parent3Name: string;
  parent3IdCard: string;
  parent3Phone: string;
  childName: string;
  childIdCard: string;
  childGender: string;
  childHeight: string;
  childWeight: string;
  childSize: string;
  child2Name: string;
  child2IdCard: string;
  child2Gender: string;
  child2Height: string;
  child2Weight: string;
  child2Size: string;
  roomNumber: string;
  roomType: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type AttendancePoint = {
  id: string;
  name: string;
  dayIndex: number;
  processIndex: number;
  sortOrder: number;
};

export type AttendanceRecord = {
  id: string;
  pointId: string;
  participantId: string;
  status: AttendanceStatus;
  note: string;
  updatedAt: string;
};

export type AttendanceRecordInput = {
  pointId: string;
  participantId: string;
  status: AttendanceStatus;
  note: string;
};

export type AttendanceFamilySummary = {
  participant: Participant;
  records: AttendanceRecord[];
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  lastUpdatedAt: string;
};

export type BootstrapData = {
  sessions: CampSession[];
  teams: Team[];
  points: ItineraryPoint[];
  categories: string[];
  roles: Array<{ value: Role; label: string }>;
};

export type EditableConfig = BootstrapData;
