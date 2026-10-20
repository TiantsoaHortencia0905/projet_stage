import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LuArrowRight,
  LuCircleCheck,
  LuDatabase,
  LuFile,
  LuFolderOpen,
  LuGithub,
  LuHardDrive,
  LuRocket,
} from "react-icons/lu";
import { listAllDatabases } from "../api/database.api";
import { listDeployments } from "../api/deploy.api";
import { listProjects } from "../api/devops.api";
import { listEspace } from "../api/espace.api";
import { listAllfiles } from "../api/files.api";
import { useAuth } from "../components/contexts/AuthContext";
import EmptyState from "../components/ui/EmptyState";
import LoadError from "../components/ui/LoadError";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import StatusBadge from "../components/ui/StatusBadge";
import UsageBar from "../components/ui/UsageBar";
import { useResource } from "../hooks/useResource";
import { formatBytes, formatRelative, pluralize, shortId } from "../lib/format";
import { databaseStatus, deploymentStatus } from "../lib/status";
import "./Dashboard.css";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
};

const DashboardScreen = () => {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const espaces = useResource(() => listEspace(userId), [userId]);
  const fichiers = useResource(listAllfiles);
  const databases = useResource(listAllDatabases);
  const projets = useResource(() => listProjects({ limit: 100 }));
  const deploiements = useResource(() => listDeployments({ limit: 6 }));

  const storage = useMemo(() => {
    const list = espaces.data ?? [];
    return {
      used: list.reduce((sum, e) => sum + (e.tailleOccupee ?? 0), 0),
      total: list.reduce((sum, e) => sum + (e.tailleEspace ?? 0), 0),
    };
  }, [espaces.data]);

  const projectNames = useMemo(
    () => new Map((projets.data?.items ?? []).map((p) => [p.idProjet, p.nomProjet])),
    [projets.data],
  );

  const onlineDbs = (databases.data ?? []).filter((d) => d.etatBD === "EN_LIGNE").length;
  const liveDeployments = (deploiements.data?.items ?? []).filter((d) => d.etatDeploiement === "DEPLOYE").length;

  const allLoaded = !espaces.loading && !databases.loading && !projets.loading;
  const isNewUser =
    allLoaded &&
    !espaces.error &&
    !databases.error &&
    !projets.error &&
    (espaces.data?.length ?? 0) === 0 &&
    (databases.data?.length ?? 0) === 0 &&
    (projets.data?.total ?? 0) === 0;

  const firstName = user?.nom?.split(" ")[0] ?? "";

  return (
    <div className="dashboard">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description="Voici l'état de vos ressources ArchiCloud."
      />

      {isNewUser && (
        <section className="card onboarding">
          <div className="card-header">
            <div>
              <h2 className="card-title">Premiers pas</h2>
              <p className="card-subtitle">Trois étapes pour prendre en main la plateforme.</p>
            </div>
          </div>
          <ol className="onboarding-steps">
            <li>
              <Link to="/espace" className="onboarding-step">
                <span className="res-icon res-icon-accent">
                  <LuFolderOpen size={16} />
                </span>
                <span>
                  <strong>Créer un espace de stockage</strong>
                  <span>Déposez-y vos premiers fichiers.</span>
                </span>
                <LuArrowRight size={16} className="onboarding-arrow" />
              </Link>
            </li>
            <li>
              <Link to="/database" className="onboarding-step">
                <span className="res-icon res-icon-accent">
                  <LuDatabase size={16} />
                </span>
                <span>
                  <strong>Provisionner une base de données</strong>
                  <span>PostgreSQL, MySQL, MongoDB…</span>
                </span>
                <LuArrowRight size={16} className="onboarding-arrow" />
              </Link>
            </li>
            <li>
              <Link to="/deploy" className="onboarding-step">
                <span className="res-icon res-icon-accent">
                  <LuGithub size={16} />
                </span>
                <span>
                  <strong>Connecter GitHub et déployer</strong>
                  <span>Mettez une application en ligne.</span>
                </span>
                <LuArrowRight size={16} className="onboarding-arrow" />
              </Link>
            </li>
          </ol>
        </section>
      )}

      {/* Indicateurs */}
      <div className="stat-grid">
        <Link to="/espace" className="card stat">
          <span className="stat-head">
            Stockage utilisé <LuHardDrive size={16} />
          </span>
          {espaces.loading ? (
            <Skeleton height={30} width="60%" style={{ marginTop: 6 }} />
          ) : (
            <>
              <span className="stat-value">{formatBytes(storage.used)}</span>
              <UsageBar used={storage.used} total={storage.total} legend={false} />
              <span className="stat-sub">
                sur {formatBytes(storage.total)} · {pluralize(espaces.data?.length ?? 0, "espace")}
              </span>
            </>
          )}
        </Link>

        <Link to="/espace" className="card stat">
          <span className="stat-head">
            Fichiers <LuFile size={16} />
          </span>
          {fichiers.loading ? (
            <Skeleton height={30} width="40%" style={{ marginTop: 6 }} />
          ) : (
            <>
              <span className="stat-value">{fichiers.error ? "—" : (fichiers.data?.length ?? 0)}</span>
              <span className="stat-sub">dans l'ensemble de vos espaces</span>
            </>
          )}
        </Link>

        <Link to="/database" className="card stat">
          <span className="stat-head">
            Bases de données <LuDatabase size={16} />
          </span>
          {databases.loading ? (
            <Skeleton height={30} width="40%" style={{ marginTop: 6 }} />
          ) : (
            <>
              <span className="stat-value">{databases.error ? "—" : (databases.data?.length ?? 0)}</span>
              <span className="stat-sub">{pluralize(onlineDbs, "en ligne", "en ligne")}</span>
            </>
          )}
        </Link>

        <Link to="/deploy" className="card stat">
          <span className="stat-head">
            Applications <LuRocket size={16} />
          </span>
          {projets.loading ? (
            <Skeleton height={30} width="40%" style={{ marginTop: 6 }} />
          ) : (
            <>
              <span className="stat-value">{projets.error ? "—" : (projets.data?.total ?? 0)}</span>
              <span className="stat-sub">{pluralize(liveDeployments, "déploiement actif", "déploiements actifs")}</span>
            </>
          )}
        </Link>
      </div>

      <div className="dashboard-columns">
        {/* Espaces */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Espaces de stockage</h2>
            <Link to="/espace" className="card-link">
              Tout voir <LuArrowRight size={14} />
            </Link>
          </div>
          <div className="card-list">
            {espaces.loading ? (
              <ListSkeleton />
            ) : espaces.error ? (
              <div className="card-body">
                <LoadError message={espaces.error} onRetry={() => espaces.reload()} retrying={espaces.refreshing} />
              </div>
            ) : (espaces.data ?? []).length === 0 ? (
              <EmptyState compact icon={<LuFolderOpen size={20} />} title="Aucun espace" description="Créez un espace pour stocker vos fichiers." />
            ) : (
              [...(espaces.data ?? [])]
                .sort((a, b) => b.tailleOccupee - a.tailleOccupee)
                .slice(0, 5)
                .map((e) => (
                  <Link key={e.idEspace} to={`/espace/${e.idEspace}`} className="list-row">
                    <span className="res-icon">
                      <LuFolderOpen size={15} />
                    </span>
                    <div className="list-row-main">
                      <span className="res-name truncate">{e.nomEspace}</span>
                      <UsageBar used={e.tailleOccupee} total={e.tailleEspace} />
                    </div>
                  </Link>
                ))
            )}
          </div>
        </section>

        {/* Bases de données */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Bases de données</h2>
            <Link to="/database" className="card-link">
              Tout voir <LuArrowRight size={14} />
            </Link>
          </div>
          <div className="card-list">
            {databases.loading ? (
              <ListSkeleton />
            ) : databases.error ? (
              <div className="card-body">
                <LoadError message={databases.error} onRetry={() => databases.reload()} retrying={databases.refreshing} />
              </div>
            ) : (databases.data ?? []).length === 0 ? (
              <EmptyState compact icon={<LuDatabase size={20} />} title="Aucune base" description="Provisionnez une base en quelques secondes." />
            ) : (
              (databases.data ?? []).slice(0, 5).map((d) => (
                <Link key={d.idBD} to={`/database/${d.idBD}`} className="list-row">
                  <span className="res-icon">
                    <LuDatabase size={15} />
                  </span>
                  <div className="list-row-main">
                    <span className="res-name truncate">{d.nomBD}</span>
                    <span className="res-meta">
                      {d.typeBD} {d.versionBD}
                    </span>
                  </div>
                  <StatusBadge status={databaseStatus(d.etatBD)} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Déploiements récents */}
      <section className="card section-gap">
        <div className="card-header">
          <h2 className="card-title">Déploiements récents</h2>
          <Link to="/deploy" className="card-link">
            Tout voir <LuArrowRight size={14} />
          </Link>
        </div>
        <div className="card-list">
          {deploiements.loading ? (
            <ListSkeleton />
          ) : deploiements.error ? (
            <div className="card-body">
              <LoadError message={deploiements.error} onRetry={() => deploiements.reload()} retrying={deploiements.refreshing} />
            </div>
          ) : (deploiements.data?.items ?? []).length === 0 ? (
            <EmptyState
              compact
              icon={<LuRocket size={20} />}
              title="Aucun déploiement"
              description="Connectez GitHub pour déployer votre première application."
            />
          ) : (
            deploiements.data!.items.map((d) => (
              <Link key={d.idDeploiement} to={`/deploy/${d.idDeploiement}`} className="list-row">
                <span className="res-icon">
                  {d.etatDeploiement === "DEPLOYE" ? <LuCircleCheck size={15} /> : <LuRocket size={15} />}
                </span>
                <div className="list-row-main">
                  <span className="res-name truncate">{projectNames.get(d.idProjet) ?? `Déploiement ${shortId(d.idDeploiement)}`}</span>
                  <span className="res-meta">
                    {d.branche && <span className="mono">{d.branche}</span>}
                    {d.commitSha && <span className="mono"> · {d.commitSha.slice(0, 7)}</span>}
                    {" · "}
                    {formatRelative(d.dateDeploiement)}
                  </span>
                </div>
                <StatusBadge status={deploymentStatus(d.etatDeploiement)} />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const ListSkeleton = () => (
  <>
    {[0, 1, 2].map((i) => (
      <div className="list-row" key={i} aria-hidden>
        <Skeleton width={32} height={32} radius={8} />
        <div className="list-row-main">
          <Skeleton width="45%" />
          <Skeleton width="70%" height={10} />
        </div>
      </div>
    ))}
  </>
);

export default DashboardScreen;
