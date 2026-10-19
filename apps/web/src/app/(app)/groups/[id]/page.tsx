import { redirect } from "next/navigation";

/** Old discovery links lead to the student's actual group; the API verifies membership. */
export default function GroupPage() {
  redirect("/groups");
}
