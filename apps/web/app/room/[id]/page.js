import RoomClient from "../../../components/RoomClient";
import ErrorBoundary from "../../../components/ErrorBoundary";

export default async function RoomPage({ params }) {
    const { id } = await params;
    return (
        <ErrorBoundary>
            <RoomClient roomId={id} />
        </ErrorBoundary>
    );
}
