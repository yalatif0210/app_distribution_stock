package org.lhspla.redistribution;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RedistributionApplication {
    public static void main(String[] args) {
        SpringApplication.run(RedistributionApplication.class, args);
    }
}
