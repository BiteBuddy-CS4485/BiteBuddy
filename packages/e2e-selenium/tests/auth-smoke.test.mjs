import test from "node:test";
import assert from "node:assert/strict";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:19006";
const browserName = (process.env.SELENIUM_BROWSER || "chrome").toLowerCase();
const headless = process.env.SELENIUM_HEADLESS !== "false";
const timeoutMs = Number(process.env.SELENIUM_TIMEOUT_MS || 15000);

function buildDriver() {
  if (browserName === "firefox") {
    const options = new firefox.Options();
    if (headless) {
      options.addArguments("-headless");
    }
    return new Builder()
      .forBrowser("firefox")
      .setFirefoxOptions(options)
      .build();
  }

  if (browserName === "edge") {
    const options = new edge.Options();
    if (headless) {
      options.addArguments("--headless=new", "--window-size=1280,900");
    }
    return new Builder()
      .forBrowser("MicrosoftEdge")
      .setEdgeOptions(options)
      .build();
  }

  const options = new chrome.Options();
  if (headless) {
    options.addArguments("--headless=new", "--window-size=1280,900");
  }
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

async function waitForVisible(driver, locator) {
  const element = await driver.wait(until.elementLocated(locator), timeoutMs);
  await driver.wait(until.elementIsVisible(element), timeoutMs);
  return element;
}

async function clickByText(driver, text) {
  const element = await waitForVisible(
    driver,
    By.xpath(
      `//button//*[normalize-space(.)='${text}'] | //*[normalize-space(.)='${text}']`,
    ),
  );
  await element.click();
}

test("auth smoke: landing to login and empty form validation", async () => {
  const driver = buildDriver();

  try {
    await driver.get(baseUrl);

    const logo = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'BiteBuddy')]"),
    );
    assert.ok(await logo.isDisplayed());

    await driver.get(`${baseUrl}/login`);

    const title = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Welcome back')]"),
    );
    assert.ok(await title.isDisplayed());

    const emailInput = await waitForVisible(
      driver,
      By.css("input[placeholder='you@example.com']"),
    );
    assert.ok(await emailInput.isDisplayed());

    await clickByText(driver, "Sign In");

    const validationText = await waitForVisible(
      driver,
      By.xpath(
        "//*[contains(normalize-space(.), 'Please fill in all fields')]",
      ),
    );
    assert.ok(await validationText.isDisplayed());
  } finally {
    await driver.quit();
  }
});

test("signup smoke: submit stays disabled until terms are accepted", async () => {
  const driver = buildDriver();

  try {
    await driver.get(`${baseUrl}/signup`);

    const title = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Create account')]"),
    );
    assert.ok(await title.isDisplayed());

    const disabledSubmit = await waitForVisible(
      driver,
      By.xpath(
        "//*[@aria-disabled='true']//*[contains(normalize-space(.), 'Create Account')]",
      ),
    );
    assert.ok(await disabledSubmit.isDisplayed());
  } finally {
    await driver.quit();
  }
});

test("forgot-password smoke: empty email shows validation", async () => {
  const driver = buildDriver();

  try {
    await driver.get(`${baseUrl}/forgot-password`);

    const title = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Forgot Password')]"),
    );
    assert.ok(await title.isDisplayed());

    await clickByText(driver, "Send Reset Link");

    const validationText = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Please enter your email')]"),
    );
    assert.ok(await validationText.isDisplayed());
  } finally {
    await driver.quit();
  }
});

test("reset-password smoke: empty form shows required fields validation", async () => {
  const driver = buildDriver();

  try {
    await driver.get(`${baseUrl}/reset-password`);

    const title = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Create New Password')]"),
    );
    assert.ok(await title.isDisplayed());

    await clickByText(driver, "Reset Password");

    const validationText = await waitForVisible(
      driver,
      By.xpath(
        "//*[contains(normalize-space(.), 'Please fill in all fields')]",
      ),
    );
    assert.ok(await validationText.isDisplayed());
  } finally {
    await driver.quit();
  }
});
