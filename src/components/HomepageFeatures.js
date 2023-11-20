import clsx from "clsx";
import styles from "./HomepageFeatures.module.css";

const FeatureList = [
  {
    title: "Easy to Use",
    // Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Framework designed to be used by any developer level. It helps to build
        API quickly and with pleasure.
      </>
    ),
  },
  {
    title: "Widely adopted technology",
    // Svg: require("../../static/img/undraw_docusaurus_tree.svg").default,
    description: (
      <>
        Inside the framework we use widely adopted technology and as much as
        possible. <code>Mongoose</code>, <code>nodejs</code>,{" "}
        <code>express</code>, <code>winston</code>, etc
      </>
    ),
  },
  {
    title: "Ready to scale",
    // Svg: require("../../static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        Framework built in mind to scale. Out of the box it supports{" "}
        <code>cluster module</code>, <code>sentry logger</code>,{" "}
        <code>redis cache</code>
      </>
    ),
  },
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx("col col--4")}>
      {Svg && (
        <div className="text--center">
          <Svg className={styles.featureSvg} alt={title} />
        </div>
      )}
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
