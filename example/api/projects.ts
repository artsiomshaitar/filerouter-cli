/**
 * Mock projects data
 */
const PROJECTS = [
  { id: "proj_1", name: "Frontend App", details: "React + TypeScript web application" },
  { id: "proj_2", name: "Backend API", details: "Bun + Hono REST API" },
  { id: "proj_3", name: "CLI Tool", details: "FileRouter CLI framework" },
  { id: "proj_4", name: "Mobile App", details: "React Native mobile application" },
];

/**
 * Get all projects, optionally filtered by name
 */
export async function getProjects(filter?: string) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (!filter) {
    return PROJECTS;
  }

  const lowerFilter = filter.toLowerCase();
  return PROJECTS.filter((p) => p.name.toLowerCase().includes(lowerFilter));
}

/**
 * Get a project by ID
 */
export async function getProjectById(id: string, includeDetails = false) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  const project = PROJECTS.find((p) => p.id === id);

  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }

  return {
    name: project.name,
    details: includeDetails ? project.details : undefined,
  };
}
